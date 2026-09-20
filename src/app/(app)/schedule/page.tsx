"use client";

import { useState } from "react";
import { api, errMsg, DAYS } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button, Input, Select, Textarea, Modal, ConfirmDialog, Card, Badge, Tabs, LoadingBlock, ErrorState, EmptyState, PageHeader, useToast, cx } from "@/components/ui";

type Entry = { id: string; subject: string; courseCode: string; day: number; startTime: string; endTime: string; room: string; teacher: string; type: "lecture" | "lab" | "tutorial" | "study" | "personal" };
type Reminder = { id: string; title: string; note: string; remindAt: string; done: boolean };
const TYPE_STYLE: Record<Entry["type"], string> = { lecture: "border-l-accent", lab: "border-l-sky-500", tutorial: "border-l-amber-500", study: "border-l-emerald-500", personal: "border-l-fuchsia-500" };
const blank: Omit<Entry, "id"> = { subject: "", courseCode: "", day: 0, startTime: "09:00", endTime: "10:00", room: "", teacher: "", type: "lecture" };
const todayIdx = () => (new Date().getDay() + 6) % 7;

export default function SchedulePage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ entries: Entry[]; reminders: Reminder[] }>("/schedule");
  const [view, setView] = useState<"week" | "day">("week");
  const [day, setDay] = useState(todayIdx());
  const [form, setForm] = useState<Omit<Entry, "id">>(blank);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Entry | null>(null);
  const [remForm, setRemForm] = useState({ title: "", note: "", remindAt: "" });
  const [remOpen, setRemOpen] = useState(false);

  const openNew = (d = day, type: Entry["type"] = "lecture") => { setEditing(null); setForm({ ...blank, day: d, type }); setOpen(true); };
  const openEdit = (e: Entry) => { setEditing(e); const { id: _id, ...rest } = e; void _id; setForm(rest); setOpen(true); };

  async function save() {
    setSaving(true);
    try {
      await api(editing ? `/schedule/${editing.id}` : "/schedule", { method: editing ? "PUT" : "POST", body: form });
      toast(editing ? "Entry updated" : "Entry added"); setOpen(false); void reload();
    } catch (e) { toast(errMsg(e), "error"); } finally { setSaving(false); }
  }
  async function remove() {
    if (!del) return;
    try { await api(`/schedule/${del.id}`, { method: "DELETE" }); toast("Entry deleted"); void reload(); } catch (e) { toast(errMsg(e), "error"); }
    setDel(null); setOpen(false);
  }
  async function addReminder() {
    if (!remForm.title || !remForm.remindAt) return toast("Title and date/time are required", "error");
    try {
      await api("/reminders", { body: { ...remForm, remindAt: new Date(remForm.remindAt).toISOString(), done: false } });
      toast("Reminder added"); setRemOpen(false); setRemForm({ title: "", note: "", remindAt: "" }); void reload();
    } catch (e) { toast(errMsg(e), "error"); }
  }
  async function toggleReminder(r: Reminder) {
    try { await api(`/reminders/${r.id}`, { method: "PUT", body: { title: r.title, note: r.note, remindAt: r.remindAt, done: !r.done } }); void reload(); } catch (e) { toast(errMsg(e), "error"); }
  }
  async function deleteReminder(r: Reminder) {
    try { await api(`/reminders/${r.id}`, { method: "DELETE" }); void reload(); } catch (e) { toast(errMsg(e), "error"); }
  }

  const entries = data?.entries ?? [];
  const byDay = (d: number) => entries.filter((e) => e.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const EntryCard = ({ e, compact }: { e: Entry; compact?: boolean }) => (
    <button onClick={() => openEdit(e)} className={cx("w-full rounded-md border border-line border-l-4 bg-surface-2 p-2.5 text-left transition-colors hover:bg-[#1b1b1b]", TYPE_STYLE[e.type])}>
      <p className="font-mono text-[11px] text-muted">{e.startTime}–{e.endTime}</p>
      <p className="text-sm font-semibold leading-tight">{e.subject}</p>
      {!compact && <p className="mt-0.5 text-xs text-muted">{[e.courseCode, e.room, e.teacher].filter(Boolean).join(" · ") || e.type}</p>}
    </button>
  );

  return (
    <div>
      <PageHeader eyebrow="Plan" title="Schedule" subtitle="Your weekly timetable, study blocks and personal reminders."
        actions={<>
          <a href="/api/schedule/export.ics" className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent">⤓ Export .ics</a>
          <Button variant="secondary" onClick={() => openNew(day, "study")}>+ Study block</Button>
          <Button onClick={() => openNew()}>+ Add class</Button>
        </>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs tabs={[{ value: "week", label: "Weekly" }, { value: "day", label: "Daily" }]} value={view} onChange={setView} />
        <div className="flex flex-wrap gap-2 text-xs text-muted">{Object.keys(TYPE_STYLE).map((t) => <span key={t} className={cx("border-l-4 pl-1.5 capitalize", TYPE_STYLE[t as Entry["type"]])}>{t}</span>)}</div>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock rows={4} /> : (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div>
            {view === "week" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
                {DAYS.map((d, i) => (
                  <section key={d} aria-label={d} className={cx("rounded-lg border bg-surface p-2.5", i === todayIdx() ? "border-blood/60" : "border-line")}>
                    <div className="mb-2 flex items-center justify-between px-1">
                      <h2 className="text-sm font-bold">{d.slice(0, 3)} {i === todayIdx() && <Badge tone="red">Today</Badge>}</h2>
                      <button onClick={() => openNew(i)} className="rounded px-1.5 text-lg leading-none text-muted hover:text-accent" aria-label={`Add entry on ${d}`}>+</button>
                    </div>
                    <div className="space-y-1.5">{byDay(i).map((e) => <EntryCard key={e.id} e={e} compact />)}{!byDay(i).length && <p className="px-1 py-3 text-center text-xs text-muted/60">Free</p>}</div>
                  </section>
                ))}
              </div>
            ) : (
              <Card>
                <div className="mb-4 flex flex-wrap gap-1">{DAYS.map((d, i) => <button key={d} onClick={() => setDay(i)} className={cx("rounded-md px-3 py-1.5 text-sm", i === day ? "bg-blood text-white" : "text-muted hover:bg-white/5")}>{d.slice(0, 3)}</button>)}</div>
                <h2 className="mb-3 text-lg font-bold">{DAYS[day]}</h2>
                {byDay(day).length ? <div className="space-y-2">{byDay(day).map((e) => <EntryCard key={e.id} e={e} />)}</div> : <EmptyState title={`Nothing on ${DAYS[day]}`} action={<Button size="sm" onClick={() => openNew(day)}>Add entry</Button>} />}
              </Card>
            )}
            {!entries.length && <p className="mt-4 text-sm text-muted">Tip: click “+ Add class” to build your timetable. It will appear on your dashboard and can be exported to Google/Apple Calendar.</p>}
          </div>
          <aside className="space-y-4">
            <Card>
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Reminders</h2><Button size="sm" onClick={() => setRemOpen(true)}>+ Add</Button></div>
              {data?.reminders.length ? (
                <ul className="space-y-2">
                  {data.reminders.map((r) => (
                    <li key={r.id} className="flex items-start gap-2 rounded-md border border-line p-2.5">
                      <input type="checkbox" checked={r.done} onChange={() => toggleReminder(r)} className="mt-1 accent-[#c1121f]" aria-label={`Mark ${r.title} done`} />
                      <div className="min-w-0 flex-1">
                        <p className={cx("text-sm font-semibold", r.done && "text-muted line-through")}>{r.title}</p>
                        <p className={cx("text-xs", new Date(r.remindAt) < new Date() && !r.done ? "text-red-400" : "text-muted")}>{new Date(r.remindAt).toLocaleString()}</p>
                        {r.note && <p className="mt-0.5 text-xs text-muted">{r.note}</p>}
                      </div>
                      <button onClick={() => deleteReminder(r)} className="text-xs text-muted hover:text-red-400" aria-label="Delete reminder">✕</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">No reminders yet.</p>}
            </Card>
          </aside>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit entry" : "New schedule entry"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Data Structures" /></div>
          <Input label="Course code" value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} placeholder="CS201" />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Entry["type"] })}>{Object.keys(TYPE_STYLE).map((t) => <option key={t} value={t}>{t}</option>)}</Select>
          <Select label="Day" value={form.day} onChange={(e) => setForm({ ...form, day: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="End" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <Input label="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="B-204" />
          <Input label="Teacher" value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} placeholder="Dr. Rao" />
        </div>
        <div className="mt-5 flex justify-between gap-2">
          {editing ? <Button variant="danger" onClick={() => setDel(editing)}>Delete</Button> : <span />}
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>

      <Modal open={remOpen} onClose={() => setRemOpen(false)} title="New reminder">
        <div className="space-y-3">
          <Input label="Title" value={remForm.title} onChange={(e) => setRemForm({ ...remForm, title: e.target.value })} placeholder="Submit DBMS assignment" />
          <Input label="Date & time" type="datetime-local" value={remForm.remindAt} onChange={(e) => setRemForm({ ...remForm, remindAt: e.target.value })} />
          <Textarea label="Note" value={remForm.note} onChange={(e) => setRemForm({ ...remForm, note: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setRemOpen(false)}>Cancel</Button><Button onClick={addReminder}>Add reminder</Button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} title="Delete entry?" message={`Remove "${del?.subject}" from your schedule?`} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}

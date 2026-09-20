"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, errMsg, fmtDate, timeAgo } from "@/lib/api";
import { useApi, useDebounced, qs } from "@/lib/hooks";
import { Button, Input, Textarea, TagInput, Modal, ConfirmDialog, SearchBar, Select, Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Tabs, AiNotice, useToast, cx } from "@/components/ui";

type Note = { id: string; title: string; content: string; tags: string[]; pinned: boolean; archived: boolean; createdAt: string; updatedAt: string };
type AiResult = { heading: string; content: string; points: string[] };
const blank = { title: "", content: "", tags: [] as string[], pinned: false, archived: false };

function NotesInner() {
  const toast = useToast();
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<"active" | "archived">("active");
  const { data, error, loading, reload } = useApi<{ notes: Note[]; tags: string[] }>(`/notes${qs({ q, tag, sort, archived: view === "archived" })}`);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Note | null>(null);
  const [ai, setAi] = useState<{ note: Note; action: string; loading: boolean; result?: AiResult; error?: string } | null>(null);

  useEffect(() => { if (params.get("new")) openNew(); }, [params]);

  function openNew() { setEditing(null); setForm(blank); setOpen(true); }
  function openEdit(n: Note) { setEditing(n); setForm({ title: n.title, content: n.content, tags: n.tags, pinned: n.pinned, archived: n.archived }); setOpen(true); }

  async function save() {
    if (!form.title.trim()) return toast("Title is required", "error");
    setSaving(true);
    try {
      await api(editing ? `/notes/${editing.id}` : "/notes", { method: editing ? "PUT" : "POST", body: form });
      toast(editing ? "Note updated" : "Note created");
      setOpen(false);
      void reload();
    } catch (e) { toast(errMsg(e), "error"); } finally { setSaving(false); }
  }
  async function patch(n: Note, changes: Partial<Note>, msg: string) {
    try {
      await api(`/notes/${n.id}`, { method: "PUT", body: { title: n.title, content: n.content, tags: n.tags, pinned: n.pinned, archived: n.archived, ...changes } });
      toast(msg);
      void reload();
    } catch (e) { toast(errMsg(e), "error"); }
  }
  async function remove() {
    if (!toDelete) return;
    try { await api(`/notes/${toDelete.id}`, { method: "DELETE" }); toast("Note deleted"); void reload(); } catch (e) { toast(errMsg(e), "error"); }
    setToDelete(null);
  }
  async function runAi(note: Note, action: "summarize" | "explain" | "revision") {
    setAi({ note, action, loading: true });
    try { setAi({ note, action, loading: false, result: await api<AiResult>(`/notes/${note.id}/ai`, { body: { action } }) }); }
    catch (e) { setAi({ note, action, loading: false, error: errMsg(e) }); }
  }
  async function saveAiAsNote() {
    if (!ai?.result) return;
    const r = ai.result;
    try {
      await api("/notes", { body: { title: `${r.heading || ai.action} — ${ai.note.title}`.slice(0, 200), content: `${r.content}\n\n${r.points.map((p) => `- ${p}`).join("\n")}`, tags: [...ai.note.tags, "ai"].slice(0, 15), pinned: false, archived: false } });
      toast("Saved as a new note");
      setAi(null);
      void reload();
    } catch (e) { toast(errMsg(e), "error"); }
  }

  return (
    <div>
      <PageHeader eyebrow="Study" title="Notes" subtitle="Capture, organise and revise. Everything is saved to your account." actions={<Button onClick={openNew}>+ New note</Button>} />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs tabs={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} value={view} onChange={setView} />
        <SearchBar value={search} onChange={setSearch} placeholder="Search notes" className="flex-1" />
        <Select aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)} className="lg:w-44">
          <option value="">All tags</option>
          {data?.tags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </Select>
        <Select aria-label="Sort notes" value={sort} onChange={(e) => setSort(e.target.value)} className="lg:w-44">
          <option value="updated">Recently updated</option>
          <option value="created">Recently created</option>
          <option value="title">Title A–Z</option>
        </Select>
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock rows={4} /> : data && data.notes.length === 0 ? (
        <EmptyState title={q || tag ? "No notes match" : view === "archived" ? "No archived notes" : "No notes yet"} description="Create your first note to start building your knowledge base." action={view === "active" && <Button onClick={openNew}>Create note</Button>} icon="▤" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data?.notes.map((n) => (
            <Card key={n.id} hover className={cx("flex flex-col !p-4", n.pinned && "!border-blood/60")}>
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => openEdit(n)} className="text-left"><h3 className="line-clamp-2 font-bold hover:text-accent">{n.pinned && <span className="text-accent" aria-label="Pinned">📌 </span>}{n.title}</h3></button>
                <button onClick={() => patch(n, { pinned: !n.pinned }, n.pinned ? "Unpinned" : "Pinned")} className="shrink-0 rounded px-1.5 text-xs text-muted hover:text-accent" aria-label={n.pinned ? "Unpin note" : "Pin note"}>{n.pinned ? "Unpin" : "Pin"}</button>
              </div>
              <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-wrap text-sm text-muted">{n.content || <em>Empty note</em>}</p>
              {n.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{n.tags.map((t) => <button key={t} onClick={() => setTag(t)}><Badge>#{t}</Badge></button>)}</div>}
              <p className="mt-3 text-[11px] text-muted/80" title={`Created ${fmtDate(n.createdAt)}`}>Created {fmtDate(n.createdAt)} · Updated {timeAgo(n.updatedAt)}</p>
              <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
                <Button size="sm" variant="secondary" onClick={() => runAi(n, "summarize")}>✦ Summarize</Button>
                <Button size="sm" variant="secondary" onClick={() => runAi(n, "explain")}>✦ Explain</Button>
                <Button size="sm" variant="secondary" onClick={() => runAi(n, "revision")}>✦ Revision</Button>
                <span className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => patch(n, { archived: !n.archived }, n.archived ? "Restored" : "Archived")}>{n.archived ? "Restore" : "Archive"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setToDelete(n)} aria-label="Delete note">Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit note" : "New note"} wide>
        <div className="space-y-4">
          <Input label="Title" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Operating Systems — Paging" />
          <Textarea label="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[260px] font-mono text-[13px]" placeholder="Write your note…" />
          <TagInput label="Tags" value={form.tags} onChange={(tags) => setForm({ ...form, tags: tags.map((t) => t.toLowerCase()) })} placeholder="os, exam, unit-3" max={15} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="accent-[#c1121f]" /> Pin this note</label>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save note</Button></div>
        </div>
      </Modal>

      <Modal open={!!ai} onClose={() => setAi(null)} title={`AI ${ai?.action ?? ""}: ${ai?.note.title ?? ""}`} wide>
        {ai?.loading && <LoadingBlock rows={3} />}
        {ai?.error && <ErrorState message={ai.error} onRetry={() => runAi(ai.note, ai.action as "summarize")} />}
        {ai?.result && (
          <div className="space-y-4">
            <h3 className="font-bold">{ai.result.heading}</h3>
            <p className="whitespace-pre-wrap text-sm text-muted">{ai.result.content}</p>
            {ai.result.points.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{ai.result.points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
            <AiNotice />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setAi(null)}>Close</Button><Button onClick={saveAiAsNote}>Save as note</Button></div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!toDelete} title="Delete note?" message={`"${toDelete?.title}" will be permanently deleted.`} onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}

export default function NotesPage() {
  return <Suspense fallback={<LoadingBlock />}><NotesInner /></Suspense>;
}

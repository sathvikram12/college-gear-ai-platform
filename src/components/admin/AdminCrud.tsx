"use client";

import { useMemo, useState } from "react";
import { api, errMsg, fmtDate } from "@/lib/api";
import { useApi, qs } from "@/lib/hooks";
import { Button, Input, Textarea, Select, TagInput, Modal, ConfirmDialog, Badge, SearchBar, LoadingBlock, ErrorState, EmptyState, PageHeader, useToast } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };
type FieldDef = { key: string; label: string; type: "text" | "textarea" | "number" | "select" | "checkbox" | "tags" | "date" | "remote" | "options"; options?: string[]; remote?: { path: string; label: string }; default?: unknown };
type Config = { title: string; subtitle: string; path: string; listPath?: string; fields: FieldDef[]; columns: string[]; canCreate?: boolean; canDelete?: boolean; editOnly?: boolean };

const NEWS_CATS = ["ai", "programming", "cybersecurity", "web-development", "college-technology", "career"];
const RES_CATS = ["study-material", "programming", "career", "interview", "documentation", "videos", "tools", "college-resources"];

export const ADMIN_CONFIG: Record<string, Config> = {
  users: { title: "Workspaces", subtitle: "Anonymous browser workspaces (no accounts). Disable a workspace to block abuse. Changes are audited.", path: "/admin/users", editOnly: true, canCreate: false, canDelete: false, columns: ["name", "role", "isActive", "lastLoginAt", "createdAt"], fields: [{ key: "role", label: "Role", type: "select", options: ["student", "faculty", "admin"] }, { key: "isActive", label: "Active", type: "checkbox", default: true }] },
  quizzes: { title: "Quizzes", subtitle: "Create quizzes; add questions in the Questions section.", path: "/admin/quizzes", columns: ["title", "category", "bank", "questionCount", "isActive"], fields: [{ key: "title", label: "Title", type: "text" }, { key: "category", label: "Category slug", type: "text" }, { key: "description", label: "Description", type: "textarea" }, { key: "timeLimitSeconds", label: "Time limit (seconds)", type: "number", default: 900 }, { key: "questionCount", label: "Questions per attempt", type: "number", default: 15 }, { key: "isActive", label: "Active", type: "checkbox", default: true }] },
  questions: { title: "Quiz Questions", subtitle: "Exactly one option must be correct. Delete archives the question (hidden from students).", path: "/admin/questions", columns: ["question", "difficulty", "isArchived"], fields: [{ key: "quizId", label: "Quiz", type: "remote", remote: { path: "/admin/quizzes", label: "title" } }, { key: "question", label: "Question", type: "textarea" }, { key: "options", label: "Options", type: "options" }, { key: "explanation", label: "Explanation", type: "textarea" }, { key: "difficulty", label: "Difficulty", type: "select", options: ["easy", "medium", "hard"], default: "medium" }, { key: "isArchived", label: "Archived (hidden)", type: "checkbox", default: false }] },
  interviews: { title: "Interview Questions", subtitle: "Questions used in randomised mock interview sessions.", path: "/admin/interviews", columns: ["question", "difficulty"], fields: [{ key: "categoryId", label: "Category", type: "remote", remote: { path: "/admin/interview-categories", label: "name" } }, { key: "question", label: "Question", type: "textarea" }, { key: "guidance", label: "What strong answers cover", type: "textarea" }, { key: "difficulty", label: "Difficulty", type: "select", options: ["easy", "medium", "hard"], default: "medium" }] },
  news: { title: "News", subtitle: "Mark content as Demo unless it is real, sourced news.", path: "/admin/news", columns: ["title", "category", "isDemo", "publishedAt"], fields: [{ key: "title", label: "Title", type: "text" }, { key: "category", label: "Category", type: "select", options: NEWS_CATS }, { key: "summary", label: "Summary", type: "textarea" }, { key: "content", label: "Content", type: "textarea" }, { key: "source", label: "Source", type: "text", default: "COLLEGE GEAR Editorial" }, { key: "url", label: "URL (optional)", type: "text" }, { key: "isDemo", label: "Demo / sample content", type: "checkbox", default: true }] },
  announcements: { title: "Announcements", subtitle: "Published immediately to all students.", path: "/admin/announcements", columns: ["title", "category", "priority", "publishedAt"], fields: [{ key: "title", label: "Title", type: "text" }, { key: "content", label: "Content", type: "textarea" }, { key: "category", label: "Category", type: "text", default: "general" }, { key: "priority", label: "Priority", type: "select", options: ["low", "normal", "high", "urgent"], default: "normal" }, { key: "authorName", label: "Author name", type: "text", default: "Administration" }, { key: "expiresAt", label: "Expires at (optional)", type: "date" }] },
  placements: { title: "Placement Records", subtitle: "Mark as Demo unless these are official statistics. Packages in LPA.", path: "/admin/placements", columns: ["department", "graduationYear", "placementRate", "averagePackage", "offers", "isDemo"], fields: [{ key: "department", label: "Department", type: "text" }, { key: "graduationYear", label: "Graduation year", type: "number", default: new Date().getFullYear() }, { key: "placementRate", label: "Placement rate (%)", type: "number" }, { key: "averagePackage", label: "Average package (LPA)", type: "number" }, { key: "highestPackage", label: "Highest package (LPA)", type: "number" }, { key: "offers", label: "Number of offers", type: "number" }, { key: "recruiters", label: "Recruiters", type: "tags", default: [] }, { key: "isDemo", label: "Demo / sample data", type: "checkbox", default: true }] },
  resources: { title: "Resources", subtitle: "Curated links shown in the Resource Library.", path: "/admin/resources", columns: ["title", "category", "url"], fields: [{ key: "title", label: "Title", type: "text" }, { key: "description", label: "Description", type: "textarea" }, { key: "url", label: "URL", type: "text" }, { key: "category", label: "Category", type: "select", options: RES_CATS }] },
};

type Opt = { text: string; isCorrect: boolean };

function OptionsEditor({ value, onChange }: { value: Opt[]; onChange: (v: Opt[]) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Options (select the correct one)</p>
      {value.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" name="correct" checked={o.isCorrect} onChange={() => onChange(value.map((x, j) => ({ ...x, isCorrect: i === j })))} className="accent-[#c1121f]" aria-label={`Mark option ${i + 1} correct`} />
          <Input aria-label={`Option ${i + 1}`} value={o.text} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          {value.length > 2 && <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="px-2 text-muted hover:text-red-400" aria-label="Remove option">✕</button>}
        </div>
      ))}
      {value.length < 6 && <Button size="sm" variant="secondary" onClick={() => onChange([...value, { text: "", isCorrect: false }])}>+ Option</Button>}
    </div>
  );
}

function RemoteSelect({ path, labelKey, value, onChange, label }: { path: string; labelKey: string; value: string; onChange: (v: string) => void; label: string }) {
  const { data } = useApi<Row[]>(path);
  return <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}><option value="">Select…</option>{data?.map((r) => <option key={r.id} value={r.id}>{String(r[labelKey])}</option>)}</Select>;
}

const cell = (v: unknown) => {
  if (typeof v === "boolean") return <Badge tone={v ? "green" : "neutral"}>{v ? "Yes" : "No"}</Badge>;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDate(v);
  if (v === null || v === undefined) return <span className="text-muted">—</span>;
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
};

export function AdminCrud({ section }: { section: string }) {
  const cfg = ADMIN_CONFIG[section];
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [quizFilter, setQuizFilter] = useState("");
  const listPath = cfg ? `${cfg.path}${qs(section === "questions" ? { quizId: quizFilter, q: search } : section === "users" ? { q: search } : {})}` : null;
  const { data, error, loading, reload } = useApi<Row[]>(listPath);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Row | null>(null);
  const [gen, setGen] = useState({ open: false, topic: "", count: 5, loading: false });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (section === "questions" || section === "users" || !search) return data;
    const s = search.toLowerCase();
    return data.filter((r) => cfg.columns.some((c) => String(r[c] ?? "").toLowerCase().includes(s)));
  }, [data, search, section, cfg]);

  if (!cfg) return <EmptyState title="Unknown admin section" />;

  function openForm(row: Row | null) {
    const f: Record<string, unknown> = {};
    for (const fd of cfg.fields) {
      let v = row ? row[fd.key] : fd.default ?? (fd.type === "number" ? 0 : fd.type === "checkbox" ? false : fd.type === "options" ? [{ text: "", isCorrect: true }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }] : "");
      if (fd.type === "date" && typeof v === "string" && v) v = v.slice(0, 16);
      if (fd.key === "quizId" && !row && quizFilter) v = quizFilter;
      f[fd.key] = v ?? "";
    }
    setEditing(row); setForm(f); setOpen(true);
  }

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = { ...form };
    for (const fd of cfg.fields) {
      if (fd.type === "number") body[fd.key] = Number(body[fd.key]);
      if (fd.type === "date") body[fd.key] = body[fd.key] ? new Date(String(body[fd.key])).toISOString() : null;
      if (fd.key === "url" && section === "news" && !body.url) body.url = null;
    }
    try {
      await api(editing ? `${cfg.path}/${editing.id}` : cfg.path, { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Updated" : "Created"); setOpen(false); void reload();
    } catch (e) { toast(errMsg(e), "error"); } finally { setSaving(false); }
  }
  async function remove() {
    if (!del) return;
    try { await api(`${cfg.path}/${del.id}`, { method: "DELETE" }); toast(section === "questions" ? "Question archived" : "Deleted"); void reload(); } catch (e) { toast(errMsg(e), "error"); }
    setDel(null);
  }
  async function generate() {
    if (!quizFilter) return toast("Select a quiz filter first", "error");
    setGen((g) => ({ ...g, loading: true }));
    try {
      const r = await api<{ created: number }>("/admin/questions/generate", { body: { quizId: quizFilter, topic: gen.topic, count: gen.count } });
      toast(`${r.created} AI draft question(s) created as archived — review and unarchive them`); setGen({ open: false, topic: "", count: 5, loading: false }); void reload();
    } catch (e) { toast(errMsg(e), "error"); setGen((g) => ({ ...g, loading: false })); }
  }

  return (
    <div>
      <PageHeader title={cfg.title} subtitle={cfg.subtitle} actions={<>
        {section === "questions" && <Button variant="secondary" onClick={() => setGen({ ...gen, open: true })}>✦ AI draft questions</Button>}
        {cfg.canCreate !== false && <Button onClick={() => openForm(null)}>+ New</Button>}
      </>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchBar value={search} onChange={setSearch} placeholder={`Search ${cfg.title.toLowerCase()}`} className="flex-1" />
        {section === "questions" && <div className="sm:w-72"><RemoteSelect path="/admin/quizzes" labelKey="title" value={quizFilter} onChange={setQuizFilter} label="Filter by quiz" /></div>}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock rows={5} /> : !filtered.length ? <EmptyState title="Nothing here yet" /> : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted"><tr>{cfg.columns.map((c) => <th key={c} className="p-3">{c.replace(/([A-Z])/g, " $1")}</th>)}<th className="p-3 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-white/[0.02]">
                  {cfg.columns.map((c) => <td key={c} className="max-w-[360px] p-3">{cell(r[c])}</td>)}
                  <td className="whitespace-nowrap p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openForm(r)}>Edit</Button>
                    {cfg.canDelete !== false && <Button size="sm" variant="ghost" onClick={() => setDel(r)}>{section === "questions" ? "Archive" : "Delete"}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">{filtered.length} record(s)</p>

      <Modal open={open} onClose={() => setOpen(false)} title={`${editing ? "Edit" : "New"} ${cfg.title.replace(/s$/, "").toLowerCase()}`} wide>
        <div className="space-y-3">
          {section === "users" && editing && <p className="text-sm text-muted">{String(editing.name)} · {String(editing.email)}</p>}
          {cfg.fields.map((fd) => {
            const v = form[fd.key];
            const set = (nv: unknown) => setForm((f) => ({ ...f, [fd.key]: nv }));
            switch (fd.type) {
              case "textarea": return <Textarea key={fd.key} label={fd.label} value={String(v ?? "")} onChange={(e) => set(e.target.value)} />;
              case "number": return <Input key={fd.key} label={fd.label} type="number" step="any" value={String(v ?? "")} onChange={(e) => set(e.target.value)} />;
              case "select": return <Select key={fd.key} label={fd.label} value={String(v ?? "")} onChange={(e) => set(e.target.value)}><option value="" disabled>Select…</option>{fd.options?.map((o) => <option key={o} value={o}>{o}</option>)}</Select>;
              case "checkbox": return <label key={fd.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} className="accent-[#c1121f]" />{fd.label}</label>;
              case "tags": return <TagInput key={fd.key} label={fd.label} value={(v as string[]) ?? []} onChange={set} />;
              case "date": return <Input key={fd.key} label={fd.label} type="datetime-local" value={String(v ?? "")} onChange={(e) => set(e.target.value)} />;
              case "remote": return <RemoteSelect key={fd.key} label={fd.label} path={fd.remote!.path} labelKey={fd.remote!.label} value={String(v ?? "")} onChange={set} />;
              case "options": return <OptionsEditor key={fd.key} value={(v as Opt[]) ?? []} onChange={set} />;
              default: return <Input key={fd.key} label={fd.label} value={String(v ?? "")} onChange={(e) => set(e.target.value)} />;
            }
          })}
          <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>

      <Modal open={gen.open} onClose={() => setGen({ ...gen, open: false })} title="AI draft questions">
        <div className="space-y-3">
          <p className="text-sm text-muted">Generates multiple-choice drafts into the selected quiz as <b>archived</b>. Review each for accuracy, then unarchive to publish.</p>
          <RemoteSelect path="/admin/quizzes" labelKey="title" value={quizFilter} onChange={setQuizFilter} label="Quiz" />
          <Input label="Topic" value={gen.topic} onChange={(e) => setGen({ ...gen, topic: e.target.value })} placeholder="e.g. Python dictionaries" />
          <Select label="Count" value={gen.count} onChange={(e) => setGen({ ...gen, count: Number(e.target.value) })}>{[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setGen({ ...gen, open: false })}>Cancel</Button><Button onClick={generate} loading={gen.loading} disabled={gen.topic.trim().length < 2}>Generate</Button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} title={section === "questions" ? "Archive question?" : "Delete record?"} message={section === "questions" ? "Archived questions are hidden from students but kept for history." : "This permanently deletes the record."} confirmLabel={section === "questions" ? "Archive" : "Delete"} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}

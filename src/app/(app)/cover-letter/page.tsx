"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errMsg, fmtDate } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button, Input, Textarea, Card, ConfirmDialog, LoadingBlock, ErrorState, EmptyState, PageHeader, AiNotice, useToast, cx } from "@/components/ui";

type CL = { id: string; jobTitle: string; company: string; jobDescription: string; sections: { opening: string; skills: string; experience: string; closing: string }; finalText: string; createdAt: string; usedResume?: boolean };

export default function CoverLetterPage() {
  const toast = useToast();
  const list = useApi<CL[]>("/cover-letter");
  const [form, setForm] = useState({ jobTitle: "", company: "", jobDescription: "" });
  const [gen, setGen] = useState(false);
  const [genErr, setGenErr] = useState("");
  const [current, setCurrent] = useState<CL | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<CL | null>(null);

  function select(c: CL) { setCurrent(c); setText(c.finalText); }
  async function generate() {
    if (form.jobTitle.trim().length < 2 || !form.company.trim()) return setGenErr("Job title and company are required");
    setGen(true); setGenErr("");
    try {
      const c = await api<CL>("/cover-letter/generate", { body: form });
      select(c); void list.reload();
      if (!c.usedResume) toast("No saved resume found — the letter is generic. Build your resume for better results.", "info");
    } catch (e) { setGenErr(errMsg(e)); } finally { setGen(false); }
  }
  async function save() {
    if (!current) return;
    setSaving(true);
    try { const c = await api<CL>(`/cover-letter/${current.id}`, { method: "PUT", body: { finalText: text } }); setCurrent(c); toast("Cover letter saved"); void list.reload(); } catch (e) { toast(errMsg(e), "error"); } finally { setSaving(false); }
  }
  async function remove() {
    if (!del) return;
    try { await api(`/cover-letter/${del.id}`, { method: "DELETE" }); if (current?.id === del.id) setCurrent(null); void list.reload(); toast("Deleted"); } catch (e) { toast(errMsg(e), "error"); }
    setDel(null);
  }
  function downloadTxt() {
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cover-letter-${current?.company ?? "draft"}.txt`.replace(/\s+/g, "-").toLowerCase();
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <PageHeader eyebrow="Career" title="Cover Letter Generator" subtitle="Generated from your saved resume data and the job description. Edit freely before downloading." actions={<Link href="/resume" className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent">Edit resume</Link>} />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <Input label="Job title" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Software Engineer Intern" />
            <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Corp" />
            <Textarea label="Job description" value={form.jobDescription} onChange={(e) => setForm({ ...form, jobDescription: e.target.value })} className="min-h-[160px]" placeholder="Paste the job description…" />
            <Button className="w-full" onClick={generate} loading={gen}>✦ Generate cover letter</Button>
            {genErr && <ErrorState message={genErr} />}
          </Card>
          <Card>
            <h2 className="mb-2 font-bold">Saved letters</h2>
            {list.loading && !list.data ? <LoadingBlock rows={2} /> : list.data?.length ? (
              <ul className="space-y-1">{list.data.map((c) => (
                <li key={c.id} className={cx("flex items-center rounded-md", current?.id === c.id ? "bg-blood/20" : "hover:bg-white/5")}>
                  <button onClick={() => select(c)} className="min-w-0 flex-1 px-3 py-2 text-left"><p className="truncate text-sm font-semibold">{c.jobTitle} · {c.company}</p><p className="text-xs text-muted">{fmtDate(c.createdAt)}</p></button>
                  <button onClick={() => setDel(c)} className="px-3 text-xs text-muted hover:text-red-400" aria-label="Delete">✕</button>
                </li>
              ))}</ul>
            ) : <p className="text-sm text-muted">No cover letters yet.</p>}
          </Card>
        </div>
        <div>
          {gen ? <Card><LoadingBlock rows={5} /></Card> : current ? (
            <Card className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">{current.jobTitle} — {current.company}</h2>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(text).then(() => toast("Copied"))}>Copy</Button>
                  <Button size="sm" variant="secondary" onClick={downloadTxt}>⤓ .txt</Button>
                  <Button size="sm" variant="secondary" onClick={() => window.print()}>⤓ PDF</Button>
                  <Button size="sm" onClick={save} loading={saving}>Save edits</Button>
                </div>
              </div>
              <details className="rounded-md border border-line p-3 text-sm">
                <summary className="cursor-pointer font-semibold text-muted">Structured sections (opening · skills · experience · closing)</summary>
                <div className="mt-2 space-y-2 text-muted">{(["opening", "skills", "experience", "closing"] as const).map((k) => <p key={k}><b className="capitalize text-light">{k}:</b> {current.sections[k]}</p>)}</div>
              </details>
              <Textarea aria-label="Cover letter text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[420px] font-serif text-[15px] leading-relaxed" />
              <AiNotice>AI draft based on your resume. Verify every statement is accurate before sending.</AiNotice>
              <div className="cg-print hidden whitespace-pre-wrap bg-white p-10 font-serif text-[14px] leading-relaxed text-black print:block">{text}</div>
            </Card>
          ) : <EmptyState title="No letter selected" description="Fill in the job details and generate a tailored cover letter." icon="✉" />}
        </div>
      </div>
      <ConfirmDialog open={!!del} title="Delete cover letter?" message="This cannot be undone." onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}

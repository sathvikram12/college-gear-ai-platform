"use client";

import { useRef, useState, type FormEvent } from "react";
import { api, errMsg, fmtDate } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button, Input, Textarea, Card, Badge, ConfirmDialog, LoadingBlock, ErrorState, EmptyState, PageHeader, AiNotice, useToast, cx } from "@/components/ui";

type Report = { score: number; summary: string; strengths: string[]; issues: string[]; suggestions: string[] };
type Sub = { id: string; score: number | null; report: Report | null; error: string | null; createdAt: string };
type Assignment = { id: string; title: string; question: string; fileName: string; mimeType: string; sizeBytes: number; extractedChars: number; createdAt: string; latest: Sub | null };
const MAX_MB = 10;

function ReportView({ r }: { r: Report }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-accent text-2xl font-black tabular-nums">{Math.round(r.score)}</div>
        <p className="text-sm">{r.summary}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {([["Strengths", r.strengths, "text-emerald-300"], ["Issues", r.issues, "text-amber-300"], ["Suggestions", r.suggestions, "text-red-300"]] as const).map(([t, items, c]) => (
          <div key={t}><p className={cx("mb-1 text-xs font-bold uppercase", c)}>{t}</p><ul className="list-disc space-y-1 pl-4 text-sm text-muted">{items.length ? items.map((x, i) => <li key={i}>{x}</li>) : <li>—</li>}</ul></div>
        ))}
      </div>
      <AiNotice>AI-assisted evaluation for self-improvement only. This is not an official grade.</AiNotice>
    </div>
  );
}

export default function AssignmentsPage() {
  const toast = useToast();
  const list = useApi<Assignment[]>("/assignments");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [del, setDel] = useState<Assignment | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    setErr("");
    if (!f) return setFile(null);
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) { setErr("Only PDF, DOCX and TXT files are supported"); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setErr(`File exceeds ${MAX_MB} MB`); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setErr("Choose a file");
    setUploading(true); setErr("");
    const fd = new FormData();
    fd.append("file", file); fd.append("title", title || file.name); fd.append("question", question);
    try {
      const d = await api<{ assignment: Assignment; submission: Sub }>("/assignments/upload", { form: fd });
      if (d.submission.error) toast(`Uploaded, but analysis failed: ${d.submission.error}`, "error"); else toast("Analysis complete");
      setFile(null); setTitle(""); setQuestion(""); if (input.current) input.current.value = "";
      setOpen(d.assignment.id); void list.reload();
    } catch (e2) { setErr(errMsg(e2)); } finally { setUploading(false); }
  }
  async function remove() {
    if (!del) return;
    try { await api(`/assignments/${del.id}`, { method: "DELETE" }); void list.reload(); toast("Deleted"); } catch (e) { toast(errMsg(e), "error"); }
    setDel(null);
  }

  return (
    <div>
      <PageHeader eyebrow="Study" title="Assignment Checker" subtitle="Upload a PDF, DOCX or TXT. We extract the text on the server (files are never executed or stored) and AI reviews grammar, structure, completeness and concepts." />
      <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
        <Card className="self-start">
          <form onSubmit={submit} className="space-y-3">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0] ?? null); }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line px-4 py-8 text-center transition-colors hover:border-accent/60"
            >
              <span className="text-3xl text-accent" aria-hidden>⤒</span>
              <span className="mt-2 text-sm font-semibold">{file ? file.name : "Drop a file or click to browse"}</span>
              <span className="text-xs text-muted">{file ? `${(file.size / 1024).toFixed(0)} KB` : `PDF, DOCX, TXT · max ${MAX_MB} MB`}</span>
              <input ref={input} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            </label>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            <Textarea label="Assignment question / brief (optional)" value={question} onChange={(e) => setQuestion(e.target.value)} hint="Helps the AI check answer alignment." />
            {err && <ErrorState message={err} />}
            <Button type="submit" className="w-full" loading={uploading} disabled={!file}>{uploading ? "Extracting & analysing…" : "Upload & analyse"}</Button>
          </form>
        </Card>
        <div>
          {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
          {list.loading && !list.data ? <LoadingBlock /> : !list.data?.length ? <EmptyState title="No assignments analysed yet" icon="✎" /> : (
            <ul className="space-y-3">
              {list.data.map((a) => (
                <li key={a.id}>
                  <Card className="!p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <button onClick={() => setOpen(open === a.id ? null : a.id)} className="min-w-0 flex-1 text-left">
                        <p className="truncate font-bold hover:text-accent">{a.title}</p>
                        <p className="text-xs text-muted">{a.fileName} · {(a.sizeBytes / 1024).toFixed(0)} KB · {a.extractedChars.toLocaleString()} chars · {fmtDate(a.createdAt)}</p>
                      </button>
                      {a.latest?.score != null ? <Badge tone={a.latest.score >= 70 ? "green" : a.latest.score >= 40 ? "amber" : "red"}>{a.latest.score}/100</Badge> : <Badge tone="red">{a.latest?.error ? "Analysis failed" : "Pending"}</Badge>}
                      <Button size="sm" variant="ghost" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Hide" : "View report"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDel(a)}>Delete</Button>
                    </div>
                    {open === a.id && <div className="mt-4 border-t border-line pt-4">{a.latest?.report ? <ReportView r={a.latest.report} /> : <ErrorState message={a.latest?.error ?? "No report available"} />}</div>}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ConfirmDialog open={!!del} title="Delete assignment?" message="The assignment record and its AI reports will be deleted." onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}

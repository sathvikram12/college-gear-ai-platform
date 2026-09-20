"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errMsg, fmtDate } from "@/lib/api";
import { Button, Input, Textarea, TagInput, Select, Card, Badge, Tabs, LoadingBlock, ErrorState, PageHeader, ProgressBar, AiNotice, useToast, cx } from "@/components/ui";

type Edu = { institution: string; degree: string; field: string; start: string; end: string; score: string };
type Proj = { name: string; tech: string; description: string; link: string };
type Exp = { role: string; company: string; start: string; end: string; description: string };
type Cert = { name: string; issuer: string; year: string };
type LinkT = { label: string; url: string };
type Data = { personal: { fullName: string; email: string; phone: string; location: string; headline: string; summary: string }; education: Edu[]; skills: string[]; projects: Proj[]; experience: Exp[]; certifications: Cert[]; achievements: string[]; languages: string[]; links: LinkT[] };
type Template = "classic" | "modern" | "minimal";
type AiAction = "summary" | "bullets" | "project" | "skills" | "keywords" | "feedback";
type AiResult = { text: string; items: string[]; matchedKeywords: string[]; missingKeywords: string[]; score: number | null };

const EMPTY: Data = { personal: { fullName: "", email: "", phone: "", location: "", headline: "", summary: "" }, education: [], skills: [], projects: [], experience: [], certifications: [], achievements: [], languages: [], links: [] };
const SECTIONS = ["personal", "education", "skills", "projects", "experience", "certifications", "achievements", "links"] as const;
type Section = (typeof SECTIONS)[number];

function completion(d: Data) {
  const c = [!!(d.personal.fullName && d.personal.email), !!d.personal.summary, d.education.length > 0, d.skills.length > 0, d.projects.length > 0, d.experience.length > 0, d.certifications.length + d.achievements.length > 0, d.languages.length > 0, d.links.length > 0];
  return Math.round((c.filter(Boolean).length / c.length) * 100);
}

function ListEditor<T extends Record<string, string>>({ items, onChange, fields, blank, title }: { items: T[]; onChange: (v: T[]) => void; fields: { key: keyof T; label: string; area?: boolean; half?: boolean }[]; blank: T; title: (t: T) => string }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-md border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">{title(it) || `Item ${i + 1}`}</p>
            <div className="flex gap-1">
              <button disabled={i === 0} onClick={() => { const c = [...items]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; onChange(c); }} className="px-1.5 text-xs text-muted hover:text-white disabled:opacity-30" aria-label="Move up">↑</button>
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="px-1.5 text-xs text-muted hover:text-red-400" aria-label="Remove">✕</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) => (
              <div key={String(f.key)} className={f.half ? "" : "col-span-2"}>
                {f.area ? <Textarea label={f.label} value={it[f.key]} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} /> : <Input label={f.label} value={it[f.key]} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} />}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...items, { ...blank }])}>+ Add</Button>
    </div>
  );
}

function Preview({ d, t }: { d: Data; t: Template }) {
  const head = t === "modern" ? "bg-[#8b0000] text-white p-6 -m-8 mb-6" : t === "minimal" ? "border-b border-gray-300 pb-3 mb-4" : "text-center border-b-2 border-black pb-3 mb-4";
  const h2 = t === "modern" ? "text-[#8b0000] uppercase tracking-wider text-[13px] font-bold border-b border-[#8b0000]/30 pb-1 mb-2 mt-4" : t === "minimal" ? "text-gray-500 uppercase tracking-[0.2em] text-[11px] font-semibold mb-1.5 mt-4" : "uppercase text-[13px] font-bold border-b border-black mb-2 mt-4";
  const lines = (s: string) => s.split("\n").map((l) => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  return (
    <div className="cg-print mx-auto min-h-[900px] w-full max-w-[800px] overflow-hidden bg-white p-8 font-serif text-[13px] leading-relaxed text-gray-900 shadow-2xl" style={{ fontFamily: t === "minimal" ? "Helvetica, Arial, sans-serif" : "Georgia, 'Times New Roman', serif" }}>
      <header className={head}>
        <h1 className="text-[26px] font-bold leading-tight">{d.personal.fullName || "Your Name"}</h1>
        {d.personal.headline && <p className={t === "modern" ? "text-white/90" : "text-gray-700"}>{d.personal.headline}</p>}
        <p className={cx("mt-1 text-[12px]", t === "modern" ? "text-white/80" : "text-gray-600")}>{[d.personal.email, d.personal.phone, d.personal.location, ...d.links.map((l) => l.url)].filter(Boolean).join("  •  ")}</p>
      </header>
      {d.personal.summary && <section><h2 className={h2}>Summary</h2><p>{d.personal.summary}</p></section>}
      {d.education.length > 0 && <section><h2 className={h2}>Education</h2>{d.education.map((e, i) => <div key={i} className="mb-1.5 flex justify-between gap-4"><div><b>{e.institution}</b><br /><span>{[e.degree, e.field].filter(Boolean).join(", ")}{e.score ? ` — ${e.score}` : ""}</span></div><span className="shrink-0 text-gray-600">{[e.start, e.end].filter(Boolean).join(" – ")}</span></div>)}</section>}
      {d.skills.length > 0 && <section><h2 className={h2}>Skills</h2><p>{d.skills.join(" · ")}</p></section>}
      {d.experience.length > 0 && <section><h2 className={h2}>Experience</h2>{d.experience.map((e, i) => <div key={i} className="mb-2"><div className="flex justify-between gap-4"><b>{e.role}{e.company ? `, ${e.company}` : ""}</b><span className="shrink-0 text-gray-600">{[e.start, e.end].filter(Boolean).join(" – ")}</span></div><ul className="list-disc pl-5">{lines(e.description).map((l, j) => <li key={j}>{l}</li>)}</ul></div>)}</section>}
      {d.projects.length > 0 && <section><h2 className={h2}>Projects</h2>{d.projects.map((p, i) => <div key={i} className="mb-2"><div className="flex justify-between gap-4"><b>{p.name}</b>{p.link && <span className="text-gray-600">{p.link}</span>}</div>{p.tech && <p className="italic text-gray-700">{p.tech}</p>}<ul className="list-disc pl-5">{lines(p.description).map((l, j) => <li key={j}>{l}</li>)}</ul></div>)}</section>}
      {d.certifications.length > 0 && <section><h2 className={h2}>Certifications</h2><ul className="list-disc pl-5">{d.certifications.map((c, i) => <li key={i}>{c.name}{c.issuer ? ` — ${c.issuer}` : ""}{c.year ? ` (${c.year})` : ""}</li>)}</ul></section>}
      {d.achievements.length > 0 && <section><h2 className={h2}>Achievements</h2><ul className="list-disc pl-5">{d.achievements.map((a, i) => <li key={i}>{a}</li>)}</ul></section>}
      {d.languages.length > 0 && <section><h2 className={h2}>Languages</h2><p>{d.languages.join(", ")}</p></section>}
    </div>
  );
}

export default function ResumePage() {
  const toast = useToast();
  const [data, setData] = useState<Data>(EMPTY);
  const [template, setTemplate] = useState<Template>("classic");
  const [versions, setVersions] = useState<{ id: string; label: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [section, setSection] = useState<Section>("personal");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [aiAction, setAiAction] = useState<AiAction>("summary");
  const [aiTarget, setAiTarget] = useState("");
  const [jd, setJd] = useState("");
  const [ai, setAi] = useState<{ loading: boolean; result?: AiResult; error?: string }>({ loading: false });

  async function load() {
    setLoading(true); setLoadErr("");
    try {
      const d = await api<{ resume: { template: Template; data: Data } | null; versions: typeof versions }>("/resume");
      if (d.resume) { setData({ ...EMPTY, ...d.resume.data, personal: { ...EMPTY.personal, ...d.resume.data.personal } }); setTemplate(d.resume.template); }
      setVersions(d.versions);
    } catch (e) { setLoadErr(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const update = (d: Data) => { setData(d); setDirty(true); };
  const setP = (k: keyof Data["personal"], v: string) => update({ ...data, personal: { ...data.personal, [k]: v } });

  async function save(snapshotLabel?: string) {
    setSaving(true);
    try {
      await api("/resume", { method: "PUT", body: { template, data, snapshotLabel } });
      setDirty(false); toast(snapshotLabel ? "Saved & version snapshot created" : "Resume saved");
      if (snapshotLabel) void load();
    } catch (e) { toast(errMsg(e), "error"); } finally { setSaving(false); }
  }
  async function loadVersion(id: string) {
    try { const v = await api<{ data: Data; label: string }>(`/resume/versions/${id}`); update({ ...EMPTY, ...v.data }); toast(`Loaded "${v.label}" — save to keep it`, "info"); } catch (e) { toast(errMsg(e), "error"); }
  }
  async function runAi() {
    if (dirty) await save();
    setAi({ loading: true });
    try { setAi({ loading: false, result: await api<AiResult>("/resume/ai-improve", { body: { action: aiAction, target: aiTarget, jobDescription: jd } }) }); }
    catch (e) { setAi({ loading: false, error: errMsg(e) }); }
  }

  if (loading) return <LoadingBlock rows={6} />;
  if (loadErr) return <ErrorState message={loadErr} onRetry={load} />;
  const pct = completion(data);

  return (
    <div>
      <PageHeader eyebrow="Career" title="AI Resume Builder" subtitle="Your data, professionally formatted. AI improves wording only — it never invents experience or skills."
        actions={<>
          <Select aria-label="Template" value={template} onChange={(e) => { setTemplate(e.target.value as Template); setDirty(true); }} className="w-36"><option value="classic">Classic</option><option value="modern">Modern</option><option value="minimal">Minimal</option></Select>
          <Button variant="secondary" onClick={() => { const l = prompt("Version label", `Version ${new Date().toLocaleDateString()}`); if (l) void save(l.slice(0, 120)); }}>Save version</Button>
          <Button variant="secondary" onClick={() => window.print()}>⤓ Download PDF</Button>
          <Button onClick={() => save()} loading={saving}>{dirty ? "Save changes" : "Saved ✓"}</Button>
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="w-64"><ProgressBar value={pct} label="Resume completion" /></div>
        <div className="xl:hidden"><Tabs tabs={[{ value: "edit", label: "Edit" }, { value: "preview", label: "Preview" }]} value={mode} onChange={setMode} /></div>
        <Link href="/cover-letter" className="text-sm text-accent hover:underline">Generate a cover letter from this resume →</Link>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cx("space-y-4", mode === "preview" && "hidden xl:block")}>
          <div className="flex flex-wrap gap-1">{SECTIONS.map((s) => <button key={s} onClick={() => setSection(s)} className={cx("rounded-md px-3 py-1.5 text-sm capitalize", section === s ? "bg-blood text-white" : "bg-surface-2 text-muted hover:text-white")}>{s}</button>)}</div>
          <Card className="space-y-3">
            {section === "personal" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Input label="Full name" value={data.personal.fullName} onChange={(e) => setP("fullName", e.target.value)} /></div>
                <div className="col-span-2"><Input label="Headline" value={data.personal.headline} onChange={(e) => setP("headline", e.target.value)} placeholder="Computer Science Student · Backend Developer" /></div>
                <Input label="Email" value={data.personal.email} onChange={(e) => setP("email", e.target.value)} />
                <Input label="Phone" value={data.personal.phone} onChange={(e) => setP("phone", e.target.value)} />
                <div className="col-span-2"><Input label="Location" value={data.personal.location} onChange={(e) => setP("location", e.target.value)} /></div>
                <div className="col-span-2"><Textarea label="Professional summary" value={data.personal.summary} onChange={(e) => setP("summary", e.target.value)} hint="Use the AI tools below to draft one from your data." /></div>
              </div>
            )}
            {section === "education" && <ListEditor items={data.education} onChange={(v) => update({ ...data, education: v })} blank={{ institution: "", degree: "", field: "", start: "", end: "", score: "" }} title={(e) => e.institution} fields={[{ key: "institution", label: "Institution" }, { key: "degree", label: "Degree", half: true }, { key: "field", label: "Field", half: true }, { key: "start", label: "Start", half: true }, { key: "end", label: "End", half: true }, { key: "score", label: "CGPA / %" }]} />}
            {section === "skills" && <><TagInput label="Skills" value={data.skills} onChange={(v) => update({ ...data, skills: v })} placeholder="Python, React, SQL" max={60} /><TagInput label="Languages spoken" value={data.languages} onChange={(v) => update({ ...data, languages: v })} placeholder="English, Hindi" max={15} /></>}
            {section === "projects" && <ListEditor items={data.projects} onChange={(v) => update({ ...data, projects: v })} blank={{ name: "", tech: "", description: "", link: "" }} title={(p) => p.name} fields={[{ key: "name", label: "Project name", half: true }, { key: "link", label: "Link", half: true }, { key: "tech", label: "Tech stack" }, { key: "description", label: "Description (one bullet per line)", area: true }]} />}
            {section === "experience" && <ListEditor items={data.experience} onChange={(v) => update({ ...data, experience: v })} blank={{ role: "", company: "", start: "", end: "", description: "" }} title={(e) => e.role} fields={[{ key: "role", label: "Role", half: true }, { key: "company", label: "Organisation", half: true }, { key: "start", label: "Start", half: true }, { key: "end", label: "End", half: true }, { key: "description", label: "What you did (one bullet per line)", area: true }]} />}
            {section === "certifications" && <ListEditor items={data.certifications} onChange={(v) => update({ ...data, certifications: v })} blank={{ name: "", issuer: "", year: "" }} title={(c) => c.name} fields={[{ key: "name", label: "Certification" }, { key: "issuer", label: "Issuer", half: true }, { key: "year", label: "Year", half: true }]} />}
            {section === "achievements" && <Textarea label="Achievements (one per line)" value={data.achievements.join("\n")} onChange={(e) => update({ ...data, achievements: e.target.value.split("\n").slice(0, 20) })} className="min-h-[180px]" />}
            {section === "links" && <ListEditor items={data.links} onChange={(v) => update({ ...data, links: v })} blank={{ label: "", url: "" }} title={(l) => l.label} fields={[{ key: "label", label: "Label", half: true }, { key: "url", label: "URL", half: true }]} />}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-bold">✦ AI resume tools</h2>
            <Select label="Action" value={aiAction} onChange={(e) => { setAiAction(e.target.value as AiAction); setAi({ loading: false }); }}>
              <option value="summary">Write professional summary</option>
              <option value="bullets">Improve bullet points</option>
              <option value="project">Polish a project description</option>
              <option value="skills">Skill suggestions</option>
              <option value="keywords">Job description keyword match</option>
              <option value="feedback">Overall resume feedback</option>
            </Select>
            {(aiAction === "bullets" || aiAction === "project") && (
              <>
                <Select aria-label="Pick source" onChange={(e) => setAiTarget(e.target.value)} value=""><option value="">Pick from your resume…</option>{[...data.experience.map((x) => x.description), ...data.projects.map((p) => `${p.name}: ${p.description}`)].filter((s) => s.trim().length > 3).map((s, i) => <option key={i} value={s}>{s.slice(0, 70)}</option>)}</Select>
                <Textarea label="Text to improve" value={aiTarget} onChange={(e) => setAiTarget(e.target.value)} />
              </>
            )}
            {aiAction === "keywords" && <Textarea label="Job description" value={jd} onChange={(e) => setJd(e.target.value)} className="min-h-[140px]" />}
            <Button onClick={runAi} loading={ai.loading}>Run AI</Button>
            {ai.error && <ErrorState message={ai.error} onRetry={runAi} />}
            {ai.result && (
              <div className="space-y-3 rounded-md border border-line p-3">
                {ai.result.score !== null && <p className="text-sm">Score: <b className="text-accent">{Math.round(ai.result.score)}/100</b></p>}
                {ai.result.text && <p className="whitespace-pre-wrap text-sm">{ai.result.text}</p>}
                {ai.result.items.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{ai.result.items.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                {ai.result.matchedKeywords.length > 0 && <div><p className="mb-1 text-xs font-bold uppercase text-emerald-300">Matched</p><div className="flex flex-wrap gap-1">{ai.result.matchedKeywords.map((k) => <Badge key={k} tone="green">{k}</Badge>)}</div></div>}
                {ai.result.missingKeywords.length > 0 && <div><p className="mb-1 text-xs font-bold uppercase text-amber-300">Missing (add only if true)</p><div className="flex flex-wrap gap-1">{ai.result.missingKeywords.map((k) => <Badge key={k} tone="amber">{k}</Badge>)}</div></div>}
                <div className="flex flex-wrap gap-2">
                  {aiAction === "summary" && ai.result.text && <Button size="sm" onClick={() => { setP("summary", ai.result!.text); toast("Summary applied — remember to save"); }}>Apply to summary</Button>}
                  <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText([ai.result!.text, ...ai.result!.items.map((x) => `- ${x}`)].filter(Boolean).join("\n")).then(() => toast("Copied"))}>Copy</Button>
                </div>
                <AiNotice>Review AI wording carefully. Only keep statements that are true for you.</AiNotice>
              </div>
            )}
          </Card>

          {versions.length > 0 && (
            <Card>
              <h2 className="mb-2 font-bold">Saved versions</h2>
              <ul className="space-y-1">{versions.map((v) => <li key={v.id} className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-white/5"><span>{v.label} <span className="text-xs text-muted">· {fmtDate(v.createdAt)}</span></span><Button size="sm" variant="ghost" onClick={() => loadVersion(v.id)}>Load</Button></li>)}</ul>
            </Card>
          )}
        </div>
        <div className={cx(mode === "edit" && "hidden xl:block")}>
          <div className="xl:sticky xl:top-24"><div className="overflow-x-auto rounded-lg bg-neutral-800 p-3 sm:p-5"><Preview d={data} t={template} /></div></div>
        </div>
      </div>
    </div>
  );
}

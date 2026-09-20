"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errMsg, fmtDate } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button, Input, Textarea, TagInput, Select, Card, Badge, LoadingBlock, ErrorState, PageHeader, AiNotice, useToast } from "@/components/ui";

type Profile = { degree: string; department: string; year: number | null; interests: string[]; skills: string[]; preferredIndustries: string[]; careerGoals: string };
type Result = { summary: string; careerPaths: { title: string; why: string }[]; skills: string[]; courses: string[]; certifications: string[]; projects: string[]; higherStudies: string[]; nextSteps: string[] };
type Rec = { id: string; result: Result; createdAt: string };
const empty: Profile = { degree: "", department: "", year: null, interests: [], skills: [], preferredIndustries: [], careerGoals: "" };

function ResultView({ r }: { r: Result }) {
  const sections: [string, string[]][] = [["Skills to build", r.skills], ["Courses", r.courses], ["Certifications", r.certifications], ["Project ideas", r.projects], ["Higher studies", r.higherStudies], ["Next steps", r.nextSteps]];
  return (
    <div className="space-y-4">
      <p className="text-sm">{r.summary}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {r.careerPaths.map((p) => (
          <div key={p.title} className="rounded-md border border-blood/40 bg-blood/10 p-3">
            <p className="font-bold">{p.title}</p>
            <p className="mt-1 text-sm text-muted">{p.why}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.filter(([, v]) => v.length).map(([t, items]) => (
          <div key={t}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-accent">{t}</p>
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      <AiNotice>These are AI-generated suggestions based only on the information you provided — not guaranteed outcomes.</AiNotice>
    </div>
  );
}

export default function CareerPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ profile: Profile | null; history: Rec[] }>("/career/profile");
  const [p, setP] = useState<Profile>(empty);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [selected, setSelected] = useState<Rec | null>(null);

  useEffect(() => {
    if (data?.profile) setP({ ...empty, ...data.profile });
    if (data?.history.length) setSelected((s) => s ?? data.history[0]);
  }, [data]);

  async function save() {
    setSaving(true);
    try { await api("/career/profile", { method: "PUT", body: p }); toast("Career profile saved"); } catch (e) { toast(errMsg(e), "error"); throw e; } finally { setSaving(false); }
  }
  async function generate() {
    setGenerating(true); setGenError("");
    try {
      await save();
      const rec = await api<Rec>("/career/recommendations", { method: "POST" });
      setSelected(rec); void reload();
    } catch (e) { setGenError(errMsg(e)); } finally { setGenerating(false); }
  }
  async function removeRec(id: string) {
    try { await api(`/career/recommendations/${id}`, { method: "DELETE" }); if (selected?.id === id) setSelected(null); void reload(); } catch (e) { toast(errMsg(e), "error"); }
  }

  if (loading && !data) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader eyebrow="Career" title="Career Guidance" subtitle="Tell us about your goals. Get personalised suggestions for skills, courses, certifications, projects and paths." actions={<Link href="/placements" className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent">Placement dashboard →</Link>} />
      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Card className="space-y-4 self-start">
          <h2 className="font-bold">Your career profile</h2>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Degree" value={p.degree} onChange={(e) => setP({ ...p, degree: e.target.value })} placeholder="B.Tech" />
            <Select label="Year" value={p.year ?? ""} onChange={(e) => setP({ ...p, year: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>Year {y}</option>)}</Select>
          </div>
          <Input label="Department" value={p.department} onChange={(e) => setP({ ...p, department: e.target.value })} placeholder="Computer Science" />
          <TagInput label="Interests" value={p.interests} onChange={(v) => setP({ ...p, interests: v })} placeholder="AI, web development" />
          <TagInput label="Current skills" value={p.skills} onChange={(v) => setP({ ...p, skills: v })} placeholder="Python, SQL" />
          <TagInput label="Preferred industries" value={p.preferredIndustries} onChange={(v) => setP({ ...p, preferredIndustries: v })} placeholder="FinTech, HealthTech" />
          <Textarea label="Career goals" value={p.careerGoals} onChange={(e) => setP({ ...p, careerGoals: e.target.value })} placeholder="e.g. Become a backend engineer at a product company" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => save().catch(() => {})} loading={saving && !generating}>Save profile</Button>
            <Button onClick={generate} loading={generating}>✦ Generate recommendations</Button>
          </div>
          {genError && <ErrorState message={genError} onRetry={generate} />}
        </Card>
        <div className="space-y-4">
          <Card>
            {generating ? <LoadingBlock rows={4} /> : selected ? (
              <>
                <p className="mb-3 text-xs text-muted">Generated {fmtDate(selected.createdAt)}</p>
                <ResultView r={selected.result} />
              </>
            ) : <p className="py-10 text-center text-sm text-muted">Save your profile and generate recommendations to see personalised suggestions here.</p>}
          </Card>
          {!!data?.history.length && (
            <Card>
              <h2 className="mb-3 font-bold">Recommendation history</h2>
              <ul className="space-y-1">
                {data.history.map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <button onClick={() => setSelected(h)} className={`flex-1 rounded-md px-3 py-2 text-left text-sm ${selected?.id === h.id ? "bg-blood/20" : "hover:bg-white/5"}`}>
                      {fmtDate(h.createdAt)} — {h.result.careerPaths.slice(0, 2).map((c) => c.title).join(", ")}
                    </button>
                    <Badge>{h.result.careerPaths.length} paths</Badge>
                    <button onClick={() => removeRec(h.id)} className="px-2 text-xs text-muted hover:text-red-400" aria-label="Delete recommendation">✕</button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

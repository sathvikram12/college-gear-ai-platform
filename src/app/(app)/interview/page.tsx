"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, errMsg, fmtDate } from "@/lib/api";
import { useApi, useDebounced, qs } from "@/lib/hooks";
import { Button, Card, Badge, Textarea, Select, SearchBar, Tabs, LoadingBlock, ErrorState, EmptyState, PageHeader, ProgressBar, AiNotice, useToast, cx } from "@/components/ui";

type Category = { id: string; slug: string; name: string; description: string; questions: number };
type Q = { id: string; question: string; difficulty: string };
type Feedback = { relevance: number; clarity: number; structure: number; technicalUnderstanding: number; overall: number; summary: string; strengths: string[]; missingPoints: string[]; improvements: string[] };
type Answer = { id: string; questionId: string; answerText: string; feedback: Feedback | null; score: number | null };
type SessionRow = { id: string; status: string; category: string; createdAt: string; total: number; answered: number; averageScore: number | null };

function FeedbackView({ fb }: { fb: Feedback }) {
  const bars: [string, number][] = [["Relevance", fb.relevance], ["Clarity", fb.clarity], ["Structure", fb.structure], ["Technical understanding", fb.technicalUnderstanding]];
  return (
    <div className="cg-fade-up space-y-4 rounded-lg border border-blood/40 bg-blood/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">AI coaching feedback</p>
        <p className="text-2xl font-black tabular-nums">{fb.overall}<span className="text-sm text-muted">/10</span></p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{bars.map(([l, v]) => <ProgressBar key={l} label={l} value={v * 10} />)}</div>
      <p className="text-sm">{fb.summary}</p>
      <div className="grid gap-3 md:grid-cols-3">
        {([["Strengths", fb.strengths, "text-emerald-300"], ["Missing points", fb.missingPoints, "text-amber-300"], ["Suggested improvements", fb.improvements, "text-red-300"]] as const).map(([t, items, c]) => (
          <div key={t}>
            <p className={cx("mb-1 text-xs font-bold uppercase", c)}>{t}</p>
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted">{items.length ? items.map((x, i) => <li key={i}>{x}</li>) : <li>—</li>}</ul>
          </div>
        ))}
      </div>
      <AiNotice>Practice feedback only — scores are coaching indicators, not an objective hiring decision.</AiNotice>
    </div>
  );
}

function Recorder({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const speech = useRef<{ stop: () => void } | null>(null);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  async function start() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => { setUrl(URL.createObjectURL(new Blob(chunks, { type: mr.mimeType }))); stream.getTracks().forEach((t) => t.stop()); };
      mr.start();
      setRec(mr);
      // Optional live dictation via the browser's Web Speech API (where available).
      const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
      const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.continuous = true; r.interimResults = false; r.lang = "en-US";
        r.onresult = (e) => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript + " "; onTranscript(t); };
        r.start();
        speech.current = r;
      }
    } catch { setErr("Microphone permission denied or unavailable."); }
  }
  function stop() { rec?.stop(); setRec(null); speech.current?.stop(); speech.current = null; }
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (!supported) return <p className="text-xs text-muted">Audio recording is not supported in this browser.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {rec ? <Button size="sm" variant="danger" onClick={stop}>■ Stop recording</Button> : <Button size="sm" variant="secondary" onClick={start}>● Record answer</Button>}
      {rec && <span className="flex items-center gap-1 text-xs text-red-400"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Recording…</span>}
      {url && !rec && <audio controls src={url} className="h-8 max-w-[240px]" aria-label="Your recorded answer" />}
      {err && <span className="text-xs text-red-400">{err}</span>}
      <span className="text-[11px] text-muted">Audio stays in your browser for self-review; dictation (if supported) fills the text box.</span>
    </div>
  );
}
type SpeechRec = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult: (e: { resultIndex: number; results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void };

export default function InterviewPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"practice" | "history" | "bank">("practice");
  const cats = useApi<Category[]>("/interviews/categories");
  const sessions = useApi<SessionRow[]>(tab === "history" ? "/interviews/sessions" : null);
  const [bankSearch, setBankSearch] = useState("");
  const [bankCat, setBankCat] = useState("");
  const bq = useDebounced(bankSearch);
  const bank = useApi<{ id: string; question: string; guidance: string; category: string; difficulty: string }[]>(tab === "bank" ? `/interviews/questions${qs({ q: bq, category: bankCat })}` : null);
  const [count, setCount] = useState(5);
  const [session, setSession] = useState<{ id: string; category: string; questions: Q[]; answers: Record<string, Answer>; status: string } | null>(null);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"" | "start" | "submit" | "finish">("");
  const [fbError, setFbError] = useState("");

  async function start(slug: string) {
    setBusy("start");
    try {
      const d = await api<{ session: { id: string; status: string }; category: { name: string }; questions: Q[] }>("/interviews/sessions", { body: { category: slug, count } });
      setSession({ id: d.session.id, category: d.category.name, questions: d.questions, answers: {}, status: d.session.status });
      setIdx(0); setDraft(""); setFbError("");
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(""); }
  }
  async function open(id: string) {
    try {
      const d = await api<{ session: { id: string; status: string }; category: { name: string }; questions: Q[]; answers: Answer[] }>(`/interviews/sessions/${id}`);
      setSession({ id, category: d.category.name, questions: d.questions, answers: Object.fromEntries(d.answers.map((a) => [a.questionId, a])), status: d.session.status });
      setIdx(0); setDraft(d.answers.find((a) => a.questionId === d.questions[0]?.id)?.answerText ?? ""); setTab("practice");
    } catch (e) { toast(errMsg(e), "error"); }
  }
  async function submitAnswer() {
    if (!session || !draft.trim()) return;
    const q = session.questions[idx];
    setBusy("submit"); setFbError("");
    try {
      const saved = await api<Answer>(`/interviews/sessions/${session.id}/answers`, { body: { questionId: q.id, answer: draft } });
      setSession((s) => s && { ...s, answers: { ...s.answers, [q.id]: saved } });
      try {
        const withFb = await api<Answer>(`/interviews/sessions/${session.id}/feedback`, { body: { answerId: saved.id } });
        setSession((s) => s && { ...s, answers: { ...s.answers, [q.id]: withFb } });
      } catch (e) { setFbError(`Answer saved, but AI feedback failed: ${errMsg(e)}`); }
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(""); }
  }
  async function retryFeedback() {
    if (!session) return;
    const a = session.answers[session.questions[idx].id];
    if (!a) return;
    setBusy("submit"); setFbError("");
    try {
      const withFb = await api<Answer>(`/interviews/sessions/${session.id}/feedback`, { body: { answerId: a.id } });
      setSession((s) => s && { ...s, answers: { ...s.answers, [a.questionId]: withFb } });
    } catch (e) { setFbError(errMsg(e)); } finally { setBusy(""); }
  }
  async function finish() {
    if (!session) return;
    setBusy("finish");
    try { await api(`/interviews/sessions/${session.id}/complete`, { method: "POST" }); toast("Session completed and saved"); setSession(null); setTab("history"); }
    catch (e) { toast(errMsg(e), "error"); } finally { setBusy(""); }
  }
  function go(i: number) { if (!session) return; setIdx(i); setDraft(session.answers[session.questions[i].id]?.answerText ?? ""); setFbError(""); }

  if (session) {
    const q = session.questions[idx];
    const ans = session.answers[q.id];
    const done = Object.keys(session.answers).length;
    const readOnly = session.status === "completed";
    return (
      <div className="space-y-4">
        <PageHeader eyebrow={`${session.category} interview`} title={`Question ${idx + 1} of ${session.questions.length}`} actions={<><Button variant="secondary" onClick={() => setSession(null)}>Exit</Button>{!readOnly && <Button onClick={finish} loading={busy === "finish"}>Finish session</Button>}</>} />
        <ProgressBar value={(done / session.questions.length) * 100} label={`${done} answered`} />
        <div className="flex flex-wrap gap-1.5">{session.questions.map((qq, i) => <button key={qq.id} onClick={() => go(i)} className={cx("h-9 w-9 rounded text-sm font-bold", i === idx ? "bg-accent" : session.answers[qq.id] ? "bg-blood/40" : "bg-white/5 text-muted")}>{i + 1}</button>)}</div>
        <Card>
          <Badge>{q.difficulty}</Badge>
          <h2 className="mt-3 text-xl font-bold">{q.question}</h2>
          <div className="mt-4 space-y-3">
            <Textarea aria-label="Your answer" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={readOnly} className="min-h-[180px]" placeholder="Type your answer as you would say it in the interview. Use the STAR method for behavioral questions." maxLength={6000} />
            {!readOnly && <Recorder onTranscript={(t) => setDraft((d) => (d ? d + " " : "") + t.trim())} />}
            <div className="flex flex-wrap gap-2">
              {!readOnly && <Button onClick={submitAnswer} loading={busy === "submit"} disabled={!draft.trim()}>{ans ? "Resubmit for feedback" : "Submit answer"}</Button>}
              {idx < session.questions.length - 1 && <Button variant="secondary" onClick={() => go(idx + 1)}>Continue →</Button>}
            </div>
          </div>
        </Card>
        {busy === "submit" && <LoadingBlock rows={2} />}
        {fbError && <ErrorState message={fbError} onRetry={ans ? retryFeedback : undefined} />}
        {ans?.feedback && <FeedbackView fb={ans.feedback} />}
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Mock Interviews" subtitle="Random questions per session. Answer by text (or record audio), then get structured AI coaching feedback." />
      <div className="mb-5"><Tabs tabs={[{ value: "practice", label: "Start practice" }, { value: "history", label: "My sessions" }, { value: "bank", label: "Question bank" }]} value={tab} onChange={setTab} /></div>

      {tab === "practice" && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <Select label="Questions per session" value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-32">{[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
          </div>
          {cats.error && <ErrorState message={cats.error} onRetry={cats.reload} />}
          {cats.loading && !cats.data ? <LoadingBlock /> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cats.data?.map((c) => (
                <Card key={c.id} hover className="flex flex-col">
                  <h3 className="text-lg font-bold">{c.name}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted">{c.description}</p>
                  <p className="mt-3 text-xs text-muted">{c.questions} questions in bank</p>
                  <Button className="mt-4" onClick={() => start(c.slug)} loading={busy === "start"} disabled={!c.questions}>Start {c.name} session</Button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "history" && (sessions.loading && !sessions.data ? <LoadingBlock /> : sessions.error ? <ErrorState message={sessions.error} onRetry={sessions.reload} /> : !sessions.data?.length ? <EmptyState title="No sessions yet" description="Start a practice session to build your history." /> : (
        <ul className="space-y-2">
          {sessions.data.map((s) => (
            <li key={s.id}>
              <button onClick={() => open(s.id)} className="cg-card cg-card-hover flex w-full flex-wrap items-center gap-3 !p-4 text-left">
                <span className="font-bold">{s.category}</span>
                <Badge tone={s.status === "completed" ? "green" : "amber"}>{s.status}</Badge>
                <span className="text-sm text-muted">{s.answered}/{s.total} answered</span>
                {s.averageScore !== null && <span className="text-sm">Avg feedback: <b>{s.averageScore}/10</b></span>}
                <span className="ml-auto text-xs text-muted">{fmtDate(s.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      ))}

      {tab === "bank" && (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <SearchBar value={bankSearch} onChange={setBankSearch} placeholder="Search interview questions" className="flex-1" />
            <Select aria-label="Category" value={bankCat} onChange={(e) => setBankCat(e.target.value)} className="sm:w-52"><option value="">All categories</option>{cats.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</Select>
          </div>
          {bank.loading && !bank.data ? <LoadingBlock /> : (
            <ul className="space-y-2">
              {bank.data?.map((b) => (
                <li key={b.id} className="cg-card !p-4">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone="red">{b.category}</Badge><Badge>{b.difficulty}</Badge></div>
                  <p className="mt-2 font-semibold">{b.question}</p>
                  {b.guidance && <p className="mt-1 text-sm text-muted">Strong answers cover: {b.guidance}</p>}
                </li>
              ))}
              {bank.data?.length === 0 && <EmptyState title="No questions match" />}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">Want coding practice too? <Link href="/coding" className="text-accent">Open the Coding Lab →</Link></p>
        </>
      )}
    </div>
  );
}

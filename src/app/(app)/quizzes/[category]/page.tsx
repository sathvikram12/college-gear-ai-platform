"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg, titleCase } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button, Card, Badge, LoadingBlock, ErrorState, EmptyState, PageHeader, ProgressBar, ConfirmDialog, useToast, cx } from "@/components/ui";

type QuizMeta = { id: string; title: string; description: string; timeLimitSeconds: number; questionCount: number; bank: number; attempts: number; best: number | null };
type Question = { id: string; question: string; difficulty: string; options: { id: string; text: string }[] };
type Review = { questionId: string; question: string; explanation: string; selectedOptionId: string | null; isCorrect: boolean; options: { id: string; text: string; isCorrect: boolean }[] };

export default function QuizRunner() {
  const { category } = useParams<{ category: string }>();
  const toast = useToast();
  const list = useApi<QuizMeta[]>(`/quizzes?category=${encodeURIComponent(category)}`);
  const [quiz, setQuiz] = useState<QuizMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [phase, setPhase] = useState<"intro" | "running" | "result">("intro");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ attempt: { score: number; total: number; percentage: number }; review: Review[] } | null>(null);
  const startedAt = useRef(0);

  async function start(q: QuizMeta) {
    setStarting(true);
    try {
      const d = await api<{ questions: Question[] }>(`/quizzes/${q.id}`);
      if (!d.questions.length) return toast("This quiz has no questions yet", "error");
      setQuiz(q); setQuestions(d.questions); setAnswers({}); setIdx(0); setResult(null);
      setRemaining(q.timeLimitSeconds); startedAt.current = Date.now(); setPhase("running");
    } catch (e) { toast(errMsg(e), "error"); } finally { setStarting(false); }
  }

  const submit = useCallback(async () => {
    if (!quiz || submitting) return;
    setSubmitting(true); setConfirm(false);
    try {
      const d = await api<{ attempt: { score: number; total: number; percentage: number }; review: Review[] }>(`/quizzes/${quiz.id}/attempts`, {
        body: { answers: questions.map((q) => ({ questionId: q.id, optionId: answers[q.id] ?? null })), durationSeconds: Math.round((Date.now() - startedAt.current) / 1000) },
      });
      setResult(d); setPhase("result"); void list.reload();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { toast(errMsg(e), "error"); } finally { setSubmitting(false); }
  }, [quiz, submitting, questions, answers, toast, list]);

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase === "running" && remaining <= 0 && questions.length) { toast("Time's up — submitting your answers", "info"); void submit(); }
  }, [remaining, phase, questions.length, submit, toast]);

  if (list.loading && !list.data) return <LoadingBlock />;
  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />;
  if (!list.data?.length) return <EmptyState title="No quiz in this category" action={<Link href="/quizzes" className="text-accent">Back to quizzes</Link>} />;

  if (phase === "intro") {
    return (
      <div>
        <PageHeader eyebrow={titleCase(category)} title={`${titleCase(category)} quizzes`} actions={<Link href="/quizzes" className="text-sm text-muted hover:text-white">← All quizzes</Link>} />
        <div className="grid gap-4 md:grid-cols-2">
          {list.data.map((q) => (
            <Card key={q.id}>
              <h2 className="text-xl font-bold">{q.title}</h2>
              <p className="mt-1 text-sm text-muted">{q.description}</p>
              <ul className="mt-4 space-y-1 text-sm text-muted">
                <li>▸ {Math.min(q.questionCount, q.bank)} random questions from a bank of {q.bank}</li>
                <li>▸ {Math.round(q.timeLimitSeconds / 60)} minute timer — auto-submits at zero</li>
                <li>▸ Correct answers and explanations shown after submission</li>
                {q.best !== null && <li>▸ Your best: <span className="text-light">{Math.round(q.best)}%</span> in {q.attempts} attempt(s)</li>}
              </ul>
              <Button className="mt-5" size="lg" onClick={() => start(q)} loading={starting}>Start quiz</Button>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    const pct = Math.round(result.attempt.percentage);
    return (
      <div className="space-y-6">
        <Card className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{quiz?.title}</p>
          <p className="mt-3 text-6xl font-black tabular-nums">{pct}<span className="text-2xl text-accent">%</span></p>
          <p className="mt-1 text-muted">{result.attempt.score} of {result.attempt.total} correct</p>
          <p className="mt-2 text-sm">{pct >= 80 ? "Excellent work! 🔥" : pct >= 50 ? "Good effort — review the explanations below." : "Keep practising — the explanations will help."}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => quiz && start(quiz)} loading={starting}>Retake (new questions)</Button>
            <Link href="/quizzes" className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent">All quizzes</Link>
            <Link href="/jarvis" className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent">Ask Jarvis about mistakes</Link>
          </div>
        </Card>
        <h2 className="text-lg font-bold">Review</h2>
        <ol className="space-y-3">
          {result.review.map((r, i) => (
            <li key={r.questionId}>
              <Card className={cx("!p-4", r.isCorrect ? "!border-emerald-900" : "!border-red-900")}>
                <div className="flex items-start gap-2">
                  <Badge tone={r.isCorrect ? "green" : "red"}>{r.isCorrect ? "Correct" : r.selectedOptionId ? "Wrong" : "Skipped"}</Badge>
                  <p className="font-semibold">{i + 1}. {r.question}</p>
                </div>
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {r.options.map((o) => (
                    <li key={o.id} className={cx("rounded border px-3 py-2 text-sm", o.isCorrect ? "border-emerald-800 bg-emerald-950/40" : o.id === r.selectedOptionId ? "border-red-800 bg-red-950/40" : "border-line text-muted")}>
                      {o.isCorrect ? "✓ " : o.id === r.selectedOptionId ? "✗ " : ""}{o.text}
                    </li>
                  ))}
                </ul>
                {r.explanation && <p className="mt-3 text-sm text-muted"><span className="font-semibold text-light">Explanation:</span> {r.explanation}</p>}
              </Card>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const q = questions[idx];
  const answered = Object.keys(answers).length;
  const mm = String(Math.max(0, Math.floor(remaining / 60))).padStart(2, "0");
  const ss = String(Math.max(0, remaining % 60)).padStart(2, "0");
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Question {idx + 1} of {questions.length}</p>
          <p className={cx("rounded-md border px-3 py-1 font-mono text-lg font-bold tabular-nums", remaining < 60 ? "border-red-700 text-red-400 animate-pulse" : "border-line")} aria-live="polite" aria-label={`Time remaining ${mm} minutes ${ss} seconds`}>{mm}:{ss}</p>
        </div>
        <ProgressBar value={(answered / questions.length) * 100} />
        <Card className="cg-fade-up" key={q.id}>
          <Badge>{q.difficulty}</Badge>
          <h2 className="mt-3 text-lg font-bold sm:text-xl">{q.question}</h2>
          <fieldset className="mt-5 space-y-2">
            <legend className="sr-only">Choose one answer</legend>
            {q.options.map((o, i) => (
              <label key={o.id} className={cx("flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-all", answers[q.id] === o.id ? "border-accent bg-blood/20" : "border-line hover:border-white/30")}>
                <input type="radio" name={q.id} className="accent-[#c1121f]" checked={answers[q.id] === o.id} onChange={() => setAnswers({ ...answers, [q.id]: o.id })} />
                <span className="font-mono text-xs text-muted">{String.fromCharCode(65 + i)}</span>
                <span className="text-sm">{o.text}</span>
              </label>
            ))}
          </fieldset>
        </Card>
        <div className="flex justify-between gap-2">
          <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Previous</Button>
          {idx < questions.length - 1 ? <Button onClick={() => setIdx(idx + 1)}>Next →</Button> : <Button onClick={() => setConfirm(true)} loading={submitting}>Submit quiz</Button>}
        </div>
      </div>
      <aside>
        <Card className="lg:sticky lg:top-24">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Navigator · {answered}/{questions.length} answered</p>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((qq, i) => (
              <button key={qq.id} onClick={() => setIdx(i)} aria-label={`Go to question ${i + 1}`} className={cx("aspect-square rounded text-sm font-bold transition-colors", i === idx ? "bg-accent text-white" : answers[qq.id] ? "bg-blood/40 text-white" : "bg-white/5 text-muted hover:bg-white/10")}>{i + 1}</button>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={() => setConfirm(true)} loading={submitting}>Submit</Button>
        </Card>
      </aside>
      <ConfirmDialog open={confirm} title="Submit quiz?" message={answered < questions.length ? `You have ${questions.length - answered} unanswered question(s). Submit anyway?` : "Submit your answers for scoring?"} confirmLabel="Submit" onConfirm={submit} onCancel={() => setConfirm(false)} loading={submitting} />
    </div>
  );
}

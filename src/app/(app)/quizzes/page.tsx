"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi, useDebounced, qs } from "@/lib/hooks";
import { fmtDate, titleCase } from "@/lib/api";
import { Card, Badge, SearchBar, LoadingBlock, ErrorState, EmptyState, PageHeader, ProgressBar, Tabs } from "@/components/ui";

type Quiz = { id: string; title: string; category: string; description: string; timeLimitSeconds: number; questionCount: number; bank: number; attempts: number; best: number | null; average: number | null };
type Attempt = { id: string; title: string; category: string; score: number; total: number; percentage: number; durationSeconds: number; createdAt: string };

export default function QuizzesPage() {
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [tab, setTab] = useState<"quizzes" | "history">("quizzes");
  const quizzes = useApi<Quiz[]>(`/quizzes${qs({ q })}`);
  const history = useApi<Attempt[]>(tab === "history" ? "/quizzes/attempts/me" : null);

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Quizzes" subtitle="Timed 15-question sets drawn randomly from each question bank. Scored securely on the server." />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs tabs={[{ value: "quizzes", label: "All quizzes" }, { value: "history", label: "Attempt history" }]} value={tab} onChange={setTab} />
        {tab === "quizzes" && <SearchBar value={search} onChange={setSearch} placeholder="Search quizzes" className="flex-1" />}
      </div>

      {tab === "quizzes" && (
        <>
          {quizzes.error && <ErrorState message={quizzes.error} onRetry={quizzes.reload} />}
          {quizzes.loading && !quizzes.data ? <LoadingBlock rows={4} /> : quizzes.data?.length === 0 ? <EmptyState title="No quizzes found" /> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {quizzes.data?.map((z) => (
                <Link key={z.id} href={`/quizzes/${z.category}`} className="block">
                  <Card hover className="flex h-full flex-col">
                    <Badge tone="red" className="self-start">{titleCase(z.category)}</Badge>
                    <h3 className="mt-3 text-lg font-bold">{z.title}</h3>
                    <p className="mt-1 flex-1 text-sm text-muted">{z.description}</p>
                    <p className="mt-3 text-xs text-muted">{Math.min(z.questionCount, z.bank)} questions · {Math.round(z.timeLimitSeconds / 60)} min · bank of {z.bank}</p>
                    <div className="mt-3 border-t border-line pt-3">
                      {z.attempts ? (
                        <>
                          <ProgressBar value={z.best ?? 0} label={`Best score · ${z.attempts} attempt${z.attempts > 1 ? "s" : ""}`} />
                          <p className="mt-1 text-xs text-muted">Average {z.average}%</p>
                        </>
                      ) : <p className="text-xs font-semibold text-accent">Not attempted yet → Start</p>}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <>
          {history.error && <ErrorState message={history.error} onRetry={history.reload} />}
          {history.loading && !history.data ? <LoadingBlock /> : history.data?.length === 0 ? <EmptyState title="No attempts yet" description="Take a quiz to see your history here." /> : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
                  <tr><th className="p-3">Quiz</th><th className="p-3">Score</th><th className="p-3">Percentage</th><th className="p-3">Time</th><th className="p-3">Date</th></tr>
                </thead>
                <tbody>
                  {history.data?.map((a) => (
                    <tr key={a.id} className="border-t border-line">
                      <td className="p-3"><Link href={`/quizzes/${a.category}`} className="font-semibold hover:text-accent">{a.title}</Link></td>
                      <td className="p-3 tabular-nums">{a.score}/{a.total}</td>
                      <td className="p-3"><Badge tone={a.percentage >= 70 ? "green" : a.percentage >= 40 ? "amber" : "red"}>{Math.round(a.percentage)}%</Badge></td>
                      <td className="p-3 tabular-nums text-muted">{Math.floor(a.durationSeconds / 60)}m {a.durationSeconds % 60}s</td>
                      <td className="p-3 text-muted">{fmtDate(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

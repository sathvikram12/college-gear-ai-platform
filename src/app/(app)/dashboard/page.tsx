"use client";

import Link from "next/link";
import { useApi } from "@/lib/hooks";
import { DAYS, timeAgo } from "@/lib/api";
import { Card, StatCard, ProgressBar, LoadingBlock, ErrorState, EmptyState, Badge, PageHeader } from "@/components/ui";

type Dash = {
  name: string;
  stats: { quizAverage: number | null; quizzesCompleted: number; interviewSessions: number; notes: number; codingSessions: number; resumeCompletion: number; streak: number; unreadAnnouncements: number };
  upcoming: { id: string; subject: string; courseCode: string; day: number; startTime: string; endTime: string; room: string; type: string; delta: number }[];
  activity: { type: string; title: string; href: string; at: string }[];
  career: { interests: string[]; goals: string; latest: { result: { summary?: string; careerPaths?: { title: string }[] }; createdAt: string } | null };
  suggestions: { label: string; href: string; reason: string }[];
};

const QUICK = [
  { href: "/jarvis", label: "Ask Jarvis", icon: "✦" },
  { href: "/notes?new=1", label: "Create Note", icon: "▤" },
  { href: "/quizzes", label: "Start Quiz", icon: "◎" },
  { href: "/interview", label: "Practice Interview", icon: "◉" },
  { href: "/coding", label: "Open Coding Lab", icon: "</>" },
  { href: "/resume", label: "Build Resume", icon: "◆" },
  { href: "/schedule", label: "View Schedule", icon: "▦" },
];
const ICON: Record<string, string> = { quiz: "◎", note: "▤", jarvis: "✦", interview: "◉", coding: "</>" };

export default function Dashboard() {
  const { data, error, loading, reload } = useApi<Dash>("/dashboard");

  if (loading && !data) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const s = data.stats;
  const whenLabel = (d: number) => (d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Student Command Center" title={`Welcome back, ${data.name.split(" ")[0]}`} subtitle="Everything you study, practise and plan — connected in one place." />

      <section aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="cg-card cg-card-hover flex flex-col items-start gap-2 !p-3.5">
            <span className="font-mono text-sm font-bold text-accent">{q.icon}</span>
            <span className="text-sm font-semibold">{q.label}</span>
          </Link>
        ))}
      </section>

      <section aria-label="Progress" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Quiz average" value={s.quizAverage} suffix="%" href="/quizzes" />
        <StatCard label="Quizzes done" value={s.quizzesCompleted} href="/quizzes" />
        <StatCard label="Interviews" value={s.interviewSessions} href="/interview" />
        <StatCard label="Saved notes" value={s.notes} href="/notes" />
        <StatCard label="Code sessions" value={s.codingSessions} href="/coding" />
        <StatCard label="Resume" value={s.resumeCompletion} suffix="%" href="/resume" />
        <StatCard label="Learning streak" value={s.streak} suffix={s.streak === 1 ? " day" : " days"} hint="Consecutive active days" />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Next best actions</h2>
            <Badge tone="red">Personalised</Badge>
          </div>
          {data.suggestions.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.suggestions.map((x) => (
                <li key={x.label}>
                  <Link href={x.href} className="block h-full rounded-md border border-line p-3 transition-colors hover:border-accent/60 hover:bg-blood/10">
                    <p className="text-sm font-semibold">{x.label} →</p>
                    <p className="mt-1 text-xs text-muted">{x.reason}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">You&apos;re on top of everything. Ask Jarvis for a new challenge!</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-bold">Resume completion</h2>
          <ProgressBar value={s.resumeCompletion} label="Sections completed" />
          <Link href="/resume" className="mt-4 inline-block text-sm text-accent hover:underline">Continue building →</Link>
          {s.unreadAnnouncements > 0 && (
            <Link href="/announcements" className="mt-5 flex items-center justify-between rounded-md border border-blood/40 bg-blood/10 p-3 text-sm">
              <span>Unread announcements</span>
              <Badge tone="red">{s.unreadAnnouncements}</Badge>
            </Link>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Upcoming schedule</h2>
            <Link href="/schedule" className="text-xs text-accent hover:underline">Open</Link>
          </div>
          {data.upcoming.length ? (
            <ul className="space-y-2">
              {data.upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-md border border-line p-2.5">
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-[10px] font-bold uppercase text-accent">{whenLabel(e.delta)}</p>
                    <p className="text-sm font-bold tabular-nums">{e.startTime}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{e.subject}</p>
                    <p className="truncate text-xs text-muted">{DAYS[e.day]} · {e.type}{e.room ? ` · ${e.room}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No classes yet" description="Add your timetable to see upcoming classes." action={<Link href="/schedule" className="text-sm text-accent">Add schedule →</Link>} />
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-bold">Recent activity</h2>
          {data.activity.length ? (
            <ul className="space-y-1">
              {data.activity.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="flex items-center gap-3 rounded-md p-2 hover:bg-white/5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-blood/15 font-mono text-xs text-accent">{ICON[a.type]}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{a.title}</span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(a.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity yet" description="Your quizzes, notes, chats and sessions will appear here." />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Career snapshot</h2>
            <Link href="/career" className="text-xs text-accent hover:underline">Career hub</Link>
          </div>
          {data.career.interests.length ? (
            <div className="mb-3 flex flex-wrap gap-1.5">{data.career.interests.map((i) => <Badge key={i}>{i}</Badge>)}</div>
          ) : (
            <p className="mb-3 text-sm text-muted">No career interests set yet.</p>
          )}
          {data.career.goals && <p className="mb-3 line-clamp-3 text-sm text-muted">Goal: {data.career.goals}</p>}
          {data.career.latest ? (
            <div className="rounded-md border border-line p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent">Latest AI suggestions · {timeAgo(data.career.latest.createdAt)}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(data.career.latest.result.careerPaths ?? []).slice(0, 3).map((p) => <li key={p.title}>▸ {p.title}</li>)}
              </ul>
            </div>
          ) : (
            <Link href="/career" className="text-sm text-accent hover:underline">Generate career recommendations →</Link>
          )}
        </Card>
      </div>
    </div>
  );
}

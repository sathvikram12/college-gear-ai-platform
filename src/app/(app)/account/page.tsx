"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, errMsg, fmtDate } from "@/lib/api";
import { useWorkspace, type Account } from "@/components/WorkspaceProvider";
import { Button, Card, Badge, StatCard, LoadingBlock, ErrorState, PageHeader, Spinner } from "@/components/ui";

type Stats = { quizAverage: number | null; quizzesCompleted: number; interviewSessions: number; notes: number; codingSessions: number; resumeCompletion: number; streak: number };
type Attempt = { id: string; title: string; percentage: number; createdAt: string };

/** Protected account area: only for signed-in users (server enforces it via GET /api/auth/me → 401). */
export default function AccountPage() {
  const router = useRouter();
  const { account, authReady, logout } = useWorkspace();
  const [me, setMe] = useState<Account | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!account) {
      router.replace("/login?next=/account");
      return;
    }
    let active = true;
    Promise.all([
      api<{ user: Account }>("/auth/me"),
      api<{ stats: Stats }>("/dashboard"),
      api<Attempt[]>("/quizzes/attempts/me"),
    ])
      .then(([m, d, a]) => {
        if (!active) return;
        setMe(m.user);
        setStats(d.stats);
        setAttempts(a);
      })
      .catch((e) => active && setError(errMsg(e)));
    return () => {
      active = false;
    };
  }, [authReady, account, router]);

  async function doLogout() {
    setLoggingOut(true);
    await logout();
    router.push("/");
  }

  if (!authReady || !account) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (error) return <ErrorState message={error} />;
  if (!me || !stats) return <LoadingBlock rows={4} />;

  const chart = [...attempts].reverse().slice(-12).map((a) => ({ name: fmtDate(a.createdAt), score: Math.round(a.percentage), quiz: a.title }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="My Account" title={`Hi, ${me.name.split(" ")[0]}`} subtitle="Your account keeps your notes, schedule, resume, quiz history and other work saved to your login." actions={<Button variant="secondary" onClick={doLogout} loading={loggingOut}>Log out</Button>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 font-bold">Account details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Name</dt><dd className="truncate">{me.name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Email</dt><dd className="truncate">{me.email}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Role</dt><dd><Badge tone="red">{me.role}</Badge></dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Member since</dt><dd>{fmtDate(me.createdAt)}</dd></div>
            {me.lastLoginAt && <div className="flex justify-between gap-3"><dt className="text-muted">Last active</dt><dd>{fmtDate(me.lastLoginAt)}</dd></div>}
          </dl>
          <Link href="/profile" className="mt-4 inline-block text-sm text-accent hover:underline">View / edit profile →</Link>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-bold">Recent quiz scores</h2>
          {chart.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: -20 }}>
                  <CartesianGrid stroke="#222" vertical={false} />
                  <XAxis dataKey="name" stroke="#a8a8a8" fontSize={10} />
                  <YAxis stroke="#a8a8a8" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip contentStyle={{ background: "#0d0d0d", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => [`${v}%`, "Score"]} labelFormatter={(_, p) => (p?.[0]?.payload as { quiz?: string })?.quiz ?? ""} />
                  <Bar dataKey="score" fill="#c1121f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted">No quiz attempts yet. <Link href="/quizzes" className="text-accent">Take a quiz →</Link></p>
          )}
        </Card>
      </div>

      <section aria-label="Progress" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Quiz average" value={stats.quizAverage} suffix="%" href="/quizzes" />
        <StatCard label="Quizzes done" value={stats.quizzesCompleted} href="/quizzes" />
        <StatCard label="Interviews" value={stats.interviewSessions} href="/interview" />
        <StatCard label="Saved notes" value={stats.notes} href="/notes" />
        <StatCard label="Code sessions" value={stats.codingSessions} href="/coding" />
        <StatCard label="Resume" value={stats.resumeCompletion} suffix="%" href="/resume" />
        <StatCard label="Learning streak" value={stats.streak} suffix={stats.streak === 1 ? " day" : " days"} />
      </section>
    </div>
  );
}

"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "@/lib/hooks";
import { timeAgo } from "@/lib/api";
import { Card, StatCard, LoadingBlock, ErrorState, PageHeader } from "@/components/ui";

type Analytics = {
  totals: Record<"students" | "faculty" | "admins" | "attempts" | "aiRequests" | "activeUsers" | "notes" | "interviews" | "assignments" | "posts" | "openReports" | "jarvisResponses", number>;
  aiByType: { action: string; n: number }[];
  daily: { day: string; signups: number; attempts: number; ai: number }[];
  recentAudit: { id: string; action: string; entity: string | null; createdAt: string; ip: string | null }[];
};

export function AdminAnalytics() {
  const { data, error, loading, reload } = useApi<Analytics>("/admin/analytics");
  if (loading && !data) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const t = data.totals;
  return (
    <div className="space-y-5">
      <PageHeader title="Admin Dashboard" subtitle="Live platform metrics from the database." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total students" value={t.students} href="/admin/users" />
        <StatCard label="Quiz attempts" value={t.attempts} />
        <StatCard label="AI requests" value={t.aiRequests} />
        <StatCard label="Active users (7d)" value={t.activeUsers} />
        <StatCard label="Notes created" value={t.notes} />
        <StatCard label="Interview sessions" value={t.interviews} />
        <StatCard label="Assignments" value={t.assignments} />
        <StatCard label="Community posts" value={t.posts} hint={t.openReports ? `${t.openReports} open report(s)` : undefined} href="/admin/reports" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-bold">Last 14 days</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily} margin={{ left: -20 }}>
                <CartesianGrid stroke="#222" vertical={false} />
                <XAxis dataKey="day" stroke="#a8a8a8" fontSize={10} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis stroke="#a8a8a8" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0d0d0d", border: "1px solid #333", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="ai" name="AI requests" stroke="#c1121f" fill="#c1121f33" />
                <Area type="monotone" dataKey="attempts" name="Quiz attempts" stroke="#f5f5f5" fill="#f5f5f511" />
                <Area type="monotone" dataKey="signups" name="Sign-ups" stroke="#a8a8a8" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">AI usage by feature</h2>
          {data.aiByType.length ? (
            <ul className="space-y-2">{data.aiByType.map((a) => <li key={a.action} className="flex justify-between text-sm"><span className="text-muted">{a.action.replace("ai.", "")}</span><b className="tabular-nums">{a.n}</b></li>)}</ul>
          ) : <p className="text-sm text-muted">No AI requests yet.</p>}
          <p className="mt-4 text-xs text-muted">Users: {t.students} students · {t.faculty} faculty · {t.admins} admins · {t.jarvisResponses} Jarvis responses</p>
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-bold">Recent audit log</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-2">Action</th><th>Entity</th><th>IP</th><th>When</th></tr></thead>
            <tbody>{data.recentAudit.map((a) => <tr key={a.id} className="border-t border-line"><td className="py-2 font-mono text-xs">{a.action}</td><td className="text-muted">{a.entity ?? "—"}</td><td className="text-muted">{a.ip ?? "—"}</td><td className="text-muted">{timeAgo(a.createdAt)}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

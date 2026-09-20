"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApi } from "@/lib/hooks";
import { Card, Badge, Select, StatCard, LoadingBlock, ErrorState, EmptyState, PageHeader } from "@/components/ui";

type Row = { id: string; department: string; graduationYear: number; placementRate: number; averagePackage: number; highestPackage: number; offers: number; recruiters: string[]; isDemo: boolean };
const COLORS = ["#c1121f", "#f5f5f5", "#8b0000", "#a8a8a8", "#ff6b6b", "#5c0000"];
const tooltipStyle = { background: "#0d0d0d", border: "1px solid #333", borderRadius: 8, color: "#f5f5f5" };

export default function PlacementsPage() {
  const { data, error, loading, reload } = useApi<Row[]>("/placements");
  const years = useMemo(() => [...new Set((data ?? []).map((r) => r.graduationYear))].sort(), [data]);
  const depts = useMemo(() => [...new Set((data ?? []).map((r) => r.department))].sort(), [data]);
  const [year, setYear] = useState<number | null>(null);
  const [dept, setDept] = useState("");
  const y = year ?? years[years.length - 1];

  if (loading && !data) return <LoadingBlock rows={5} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState title="No placement data yet" description="An administrator can add placement records from the Admin panel." />;

  const yearRows = data.filter((r) => r.graduationYear === y && (!dept || r.department === dept));
  const totalOffers = yearRows.reduce((s, r) => s + r.offers, 0);
  const avgRate = yearRows.length ? yearRows.reduce((s, r) => s + r.placementRate, 0) / yearRows.length : 0;
  const avgPkg = yearRows.length ? yearRows.reduce((s, r) => s + r.averagePackage, 0) / yearRows.length : 0;
  const highest = Math.max(0, ...yearRows.map((r) => r.highestPackage));
  const trend = years.map((yy) => ({ year: yy, ...Object.fromEntries(depts.filter((d) => !dept || d === dept).map((d) => [d, data.find((r) => r.graduationYear === yy && r.department === d)?.averagePackage ?? null])) }));
  const recruiters = [...new Set(yearRows.flatMap((r) => r.recruiters))];
  const anyDemo = data.some((r) => r.isDemo);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Career" title="Placement Dashboard" subtitle="Database-driven placement statistics by department and graduation year." actions={anyDemo ? <Badge tone="amber">Demo / sample data — not official statistics</Badge> : undefined} />
      <div className="flex flex-wrap gap-3">
        <Select label="Graduation year" value={y} onChange={(e) => setYear(Number(e.target.value))} className="w-40">{years.map((yy) => <option key={yy} value={yy}>{yy}</option>)}</Select>
        <Select label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className="w-56"><option value="">All departments</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</Select>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Avg placement rate" value={Math.round(avgRate)} suffix="%" />
        <StatCard label="Avg package (LPA)" value={Math.round(avgPkg * 10) / 10} />
        <StatCard label="Highest package (LPA)" value={highest} />
        <StatCard label="Total offers" value={totalOffers} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-bold">Placement rate by department · {y}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearRows} margin={{ left: -10 }}>
                <CartesianGrid stroke="#222" vertical={false} />
                <XAxis dataKey="department" stroke="#a8a8a8" fontSize={11} tickFormatter={(v: string) => v.split(" ")[0]} />
                <YAxis stroke="#a8a8a8" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(193,18,31,0.08)" }} />
                <Bar dataKey="placementRate" name="Placement rate %" fill="#c1121f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-bold">Average package trend (LPA)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: -10 }}>
                <CartesianGrid stroke="#222" vertical={false} />
                <XAxis dataKey="year" stroke="#a8a8a8" fontSize={11} />
                <YAxis stroke="#a8a8a8" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {depts.filter((d) => !dept || d === dept).map((d, i) => <Line key={d} type="monotone" dataKey={d} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-bold">Offers vs highest package · {y}</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearRows} margin={{ left: -10 }}>
              <CartesianGrid stroke="#222" vertical={false} />
              <XAxis dataKey="department" stroke="#a8a8a8" fontSize={11} tickFormatter={(v: string) => v.split(" ")[0]} />
              <YAxis stroke="#a8a8a8" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(193,18,31,0.08)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="offers" name="Offers" fill="#8b0000" radius={[4, 4, 0, 0]} />
              <Bar dataKey="highestPackage" name="Highest (LPA)" fill="#f5f5f5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Recruiters · {y}</h2>
        <div className="flex flex-wrap gap-2">{recruiters.length ? recruiters.map((r) => <Badge key={r}>{r}</Badge>) : <p className="text-sm text-muted">No recruiters listed.</p>}</div>
        {anyDemo && <p className="mt-3 text-xs text-muted">Recruiter names in demo records are fictional placeholders.</p>}
      </Card>
    </div>
  );
}

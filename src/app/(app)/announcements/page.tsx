"use client";

import { useState } from "react";
import { api, errMsg, fmtDate, titleCase } from "@/lib/api";
import { useApi, useDebounced, qs } from "@/lib/hooks";
import { Card, Badge, Button, SearchBar, Select, LoadingBlock, ErrorState, EmptyState, PageHeader, useToast, cx } from "@/components/ui";

type A = { id: string; title: string; content: string; category: string; priority: "low" | "normal" | "high" | "urgent"; authorName: string; publishedAt: string; expiresAt: string | null; read: boolean };
const TONE = { low: "neutral", normal: "blue", high: "amber", urgent: "red" } as const;

export default function AnnouncementsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = useDebounced(search);
  const { data, setData, error, loading, reload } = useApi<A[]>(`/announcements${qs({ q, priority, category })}`);
  const cats = [...new Set((data ?? []).map((a) => a.category))];

  async function markRead(a: A) {
    if (a.read) return;
    try { await api(`/announcements/${a.id}/read`, { method: "POST" }); setData((d) => d?.map((x) => (x.id === a.id ? { ...x, read: true } : x)) ?? null); } catch (e) { toast(errMsg(e), "error"); }
  }
  async function markAll() {
    const unread = (data ?? []).filter((a) => !a.read);
    await Promise.all(unread.map((a) => api(`/announcements/${a.id}/read`, { method: "POST" }).catch(() => {})));
    setData((d) => d?.map((x) => ({ ...x, read: true })) ?? null);
    toast("All marked as read");
  }
  const unreadCount = (data ?? []).filter((a) => !a.read).length;

  return (
    <div>
      <PageHeader eyebrow="Campus" title="Announcements" subtitle="Official notices published by administrators." actions={unreadCount > 0 ? <Button variant="secondary" onClick={markAll}>Mark all read ({unreadCount})</Button> : undefined} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Search announcements" className="flex-1" />
        <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="sm:w-40"><option value="">All priorities</option>{Object.keys(TONE).map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}</Select>
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-44"><option value="">All categories</option>{cats.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock rows={4} /> : !data?.length ? <EmptyState title="No announcements" /> : (
        <ul className="space-y-3">
          {data.map((a) => (
            <li key={a.id}>
              <Card className={cx("!p-4", !a.read && "!border-l-4 !border-l-accent")}>
                <button className="w-full text-left" aria-expanded={open === a.id} onClick={() => { setOpen(open === a.id ? null : a.id); void markRead(a); }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[a.priority]}>{a.priority}</Badge>
                    <Badge>{titleCase(a.category)}</Badge>
                    {!a.read && <Badge tone="red">New</Badge>}
                    <span className="ml-auto text-xs text-muted">{a.authorName} · {fmtDate(a.publishedAt)}</span>
                  </div>
                  <h2 className="mt-2 font-bold">{a.title}</h2>
                  <p className={cx("mt-1 whitespace-pre-wrap text-sm text-muted", open !== a.id && "line-clamp-2")}>{a.content}</p>
                </button>
                {open === a.id && a.expiresAt && <p className="mt-2 text-xs text-muted">Expires {fmtDate(a.expiresAt)}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

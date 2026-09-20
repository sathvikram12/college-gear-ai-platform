"use client";

import { useState } from "react";
import { useApi, useDebounced, qs } from "@/lib/hooks";
import { fmtDate, timeAgo, titleCase } from "@/lib/api";
import { Card, Badge, SearchBar, Tabs, LoadingBlock, ErrorState, EmptyState, PageHeader, cx } from "@/components/ui";

type News = { id: string; title: string; summary: string; category: string; source: string; url: string | null; isDemo: boolean; publishedAt: string };
type Live = { source: string; items: { id: number; title: string; url: string; score: number; time: number; by: string }[]; unavailable?: boolean };
const CATS = ["", "ai", "programming", "cybersecurity", "web-development", "college-technology", "career"];

export default function NewsPage() {
  const [tab, setTab] = useState<"curated" | "live">("curated");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const q = useDebounced(search);
  const news = useApi<News[]>(tab === "curated" ? `/news${qs({ q, category: cat })}` : null);
  const live = useApi<Live>(tab === "live" ? "/news/live" : null);

  return (
    <div>
      <PageHeader eyebrow="Stay current" title="Technology News" subtitle="Curated explainers managed by admins, plus live headlines from the public Hacker News API." />
      <div className="mb-5"><Tabs tabs={[{ value: "curated", label: "Curated" }, { value: "live", label: "Live · Hacker News" }]} value={tab} onChange={setTab} /></div>
      {tab === "curated" && (
        <>
          <div className="mb-4 flex flex-col gap-3">
            <SearchBar value={search} onChange={setSearch} placeholder="Search news" />
            <div className="flex flex-wrap gap-1.5">{CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={cx("rounded-full border px-3 py-1 text-xs font-semibold", cat === c ? "border-accent bg-blood text-white" : "border-line text-muted hover:text-white")}>{c ? titleCase(c) : "All"}</button>)}</div>
          </div>
          {news.error && <ErrorState message={news.error} onRetry={news.reload} />}
          {news.loading && !news.data ? <LoadingBlock rows={4} /> : !news.data?.length ? <EmptyState title="No news found" /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {news.data.map((n) => (
                <Card key={n.id} hover className="flex flex-col">
                  <div className="flex flex-wrap gap-1.5"><Badge tone="red">{titleCase(n.category)}</Badge>{n.isDemo && <Badge tone="amber">Demo content</Badge>}</div>
                  <h2 className="mt-3 font-bold leading-snug">{n.title}</h2>
                  <p className="mt-2 flex-1 text-sm text-muted">{n.summary}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted"><span>{n.source} · {fmtDate(n.publishedAt)}</span>{n.url && <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Read →</a>}</div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {tab === "live" && (live.loading && !live.data ? <LoadingBlock rows={5} /> : live.error ? <ErrorState message={live.error} onRetry={live.reload} /> : live.data?.unavailable || !live.data?.items.length ? <ErrorState message="Live news is temporarily unavailable. Showing curated news instead is recommended." onRetry={live.reload} /> : (
        <ol className="space-y-2">
          {live.data.items.map((it, i) => (
            <li key={it.id}>
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="cg-card cg-card-hover flex items-center gap-4 !p-4">
                <span className="w-6 text-right font-mono text-sm text-accent">{i + 1}</span>
                <div className="min-w-0 flex-1"><p className="font-semibold">{it.title}</p><p className="text-xs text-muted">{it.score} points · by {it.by} · {timeAgo(new Date(it.time * 1000))}</p></div>
                <span className="text-muted">↗</span>
              </a>
            </li>
          ))}
          <p className="pt-2 text-xs text-muted">Source: Hacker News public API (live, cached for 10 minutes).</p>
        </ol>
      ))}
    </div>
  );
}

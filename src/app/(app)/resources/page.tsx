"use client";

import { useState } from "react";
import { useApi, useDebounced, qs } from "@/lib/hooks";
import { titleCase } from "@/lib/api";
import { Card, Badge, SearchBar, LoadingBlock, ErrorState, EmptyState, PageHeader, cx } from "@/components/ui";

type R = { id: string; title: string; description: string; url: string; category: string; createdAt: string };
const CATS = ["", "study-material", "programming", "career", "interview", "documentation", "videos", "tools", "college-resources"];

export default function ResourcesPage() {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const q = useDebounced(search);
  const { data, error, loading, reload } = useApi<R[]>(`/resources${qs({ q, category: cat })}`);
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

  return (
    <div>
      <PageHeader eyebrow="Library" title="Resources" subtitle="Hand-picked learning material, tools and documentation — curated by administrators." />
      <div className="mb-5 space-y-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search resources" />
        <div className="flex flex-wrap gap-1.5">{CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={cx("rounded-full border px-3 py-1 text-xs font-semibold", cat === c ? "border-accent bg-blood text-white" : "border-line text-muted hover:text-white")}>{c ? titleCase(c) : "All"}</button>)}</div>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock rows={4} /> : !data?.length ? <EmptyState title="No resources found" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((r) => (
            <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="block">
              <Card hover className="flex h-full flex-col">
                <Badge tone="red" className="self-start">{titleCase(r.category)}</Badge>
                <h2 className="mt-3 font-bold">{r.title} <span className="text-muted">↗</span></h2>
                <p className="mt-1 flex-1 text-sm text-muted">{r.description}</p>
                <p className="mt-3 font-mono text-xs text-accent">{host(r.url)}</p>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

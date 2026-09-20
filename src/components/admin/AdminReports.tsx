"use client";

import { api, errMsg, timeAgo } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button, Badge, LoadingBlock, ErrorState, EmptyState, PageHeader, Card, useToast } from "@/components/ui";

type Report = { id: string; reason: string; status: "open" | "resolved" | "dismissed"; createdAt: string; postId: string; postTitle: string; postHidden: boolean; reporter: string };

export function AdminReports() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Report[]>("/admin/reports");

  async function setStatus(r: Report, status: Report["status"]) {
    try { await api(`/admin/reports/${r.id}`, { method: "PUT", body: { status } }); toast(`Report ${status}`); void reload(); } catch (e) { toast(errMsg(e), "error"); }
  }
  async function hide(r: Report, isHidden: boolean) {
    try { await api(`/admin/forum/posts/${r.postId}`, { method: "PUT", body: { isHidden } }); toast(isHidden ? "Post hidden & reports resolved" : "Post restored"); void reload(); } catch (e) { toast(errMsg(e), "error"); }
  }
  async function deletePost(r: Report) {
    if (!confirm(`Permanently delete "${r.postTitle}"?`)) return;
    try { await api(`/admin/forum/posts/${r.postId}`, { method: "DELETE" }); toast("Post deleted"); void reload(); } catch (e) { toast(errMsg(e), "error"); }
  }

  return (
    <div>
      <PageHeader title="Community Moderation" subtitle="Review reported posts. Hide, delete, resolve or dismiss. All actions are audited." />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? <LoadingBlock /> : !data?.length ? <EmptyState title="No reports" description="The community is behaving. 🎉" /> : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === "open" ? "red" : r.status === "resolved" ? "green" : "neutral"}>{r.status}</Badge>
                  {r.postHidden && <Badge tone="amber">Post hidden</Badge>}
                  <span className="font-semibold">{r.postTitle}</span>
                  <span className="ml-auto text-xs text-muted">Reported by {r.reporter} · {timeAgo(r.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-muted">Reason: {r.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => hide(r, !r.postHidden)}>{r.postHidden ? "Unhide post" : "Hide post"}</Button>
                  <Button size="sm" variant="danger" onClick={() => deletePost(r)}>Delete post</Button>
                  {r.status !== "resolved" && <Button size="sm" variant="ghost" onClick={() => setStatus(r, "resolved")}>Resolve</Button>}
                  {r.status !== "dismissed" && <Button size="sm" variant="ghost" onClick={() => setStatus(r, "dismissed")}>Dismiss</Button>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

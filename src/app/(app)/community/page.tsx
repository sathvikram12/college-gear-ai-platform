"use client";

import { useState } from "react";
import { api, errMsg, timeAgo } from "@/lib/api";
import { useApi, useDebounced, qs } from "@/lib/hooks";
import { Button, Input, Textarea, Select, Card, Badge, Modal, ConfirmDialog, SearchBar, LoadingBlock, ErrorState, EmptyState, PageHeader, useToast, cx } from "@/components/ui";

type Cat = { id: string; slug: string; name: string; description: string };
type Post = { id: string; title: string; content: string; isHidden: boolean; createdAt: string; author: string; category: string; categorySlug: string; comments: number; isMine: boolean };
type Detail = { post: { id: string; title: string; content: string; isHidden: boolean; createdAt: string; author: string; category: string; isMine: boolean }; comments: { id: string; content: string; createdAt: string; author: string; isMine: boolean }[] };

export default function CommunityPage() {
  const toast = useToast();
  const isAdmin = false; // moderation now lives in the Admin panel (no login roles)
  const cats = useApi<Cat[]>("/forum/categories");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const q = useDebounced(search);
  const posts = useApi<Post[]>(`/forum/posts${qs({ q, category: cat })}`);
  const [compose, setCompose] = useState(false);
  const [form, setForm] = useState({ categoryId: "", title: "", content: "" });
  const [posting, setPosting] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [comment, setComment] = useState("");
  const [report, setReport] = useState<{ id: string; reason: string } | null>(null);
  const [del, setDel] = useState<{ kind: "post" | "comment"; id: string } | null>(null);

  async function openPost(id: string) {
    try { setDetail(await api<Detail>(`/forum/posts/${id}`)); setComment(""); } catch (e) { toast(errMsg(e), "error"); }
  }
  async function createPost() {
    setPosting(true);
    try { await api("/forum/posts", { body: { ...form, categoryId: form.categoryId || cats.data?.[0]?.id } }); toast("Posted"); setCompose(false); setForm({ categoryId: "", title: "", content: "" }); void posts.reload(); }
    catch (e) { toast(errMsg(e), "error"); } finally { setPosting(false); }
  }
  async function addComment() {
    if (!detail || !comment.trim()) return;
    try {
      const c = await api<Detail["comments"][number]>(`/forum/posts/${detail.post.id}/comments`, { body: { content: comment } });
      setDetail({ ...detail, comments: [...detail.comments, c] }); setComment(""); void posts.reload();
    } catch (e) { toast(errMsg(e), "error"); }
  }
  async function submitReport() {
    if (!report) return;
    try { await api(`/forum/posts/${report.id}/report`, { body: { reason: report.reason } }); toast("Reported to moderators"); setReport(null); } catch (e) { toast(errMsg(e), "error"); }
  }
  async function doDelete() {
    if (!del) return;
    try {
      if (del.kind === "post") { await api(`/forum/posts/${del.id}`, { method: "DELETE" }); setDetail(null); }
      else { await api(`/forum/comments/${del.id}`, { method: "DELETE" }); setDetail((d) => d && { ...d, comments: d.comments.filter((c) => c.id !== del.id) }); }
      toast("Deleted"); void posts.reload();
    } catch (e) { toast(errMsg(e), "error"); }
    setDel(null);
  }
  async function toggleHidden(id: string, isHidden: boolean) {
    try { await api(`/admin/forum/posts/${id}`, { method: "PUT", body: { isHidden } }); toast(isHidden ? "Post hidden" : "Post restored"); void posts.reload(); if (detail) void openPost(id); } catch (e) { toast(errMsg(e), "error"); }
  }

  return (
    <div>
      <PageHeader eyebrow="Connect" title="Community" subtitle="Ask questions, share projects and find teammates. Be kind — posts can be reported to moderators." actions={<Button onClick={() => setCompose(true)}>+ New post</Button>} />
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside>
          <nav aria-label="Categories" className="flex gap-1 overflow-x-auto lg:flex-col">
            <button onClick={() => setCat("")} className={cx("whitespace-nowrap rounded-md px-3 py-2 text-left text-sm", !cat ? "bg-blood text-white" : "text-muted hover:bg-white/5")}>All posts</button>
            {cats.data?.map((c) => <button key={c.id} onClick={() => setCat(c.slug)} className={cx("whitespace-nowrap rounded-md px-3 py-2 text-left text-sm", cat === c.slug ? "bg-blood text-white" : "text-muted hover:bg-white/5")}>{c.name}</button>)}
          </nav>
        </aside>
        <div>
          <SearchBar value={search} onChange={setSearch} placeholder="Search discussions" className="mb-4" />
          {posts.error && <ErrorState message={posts.error} onRetry={posts.reload} />}
          {posts.loading && !posts.data ? <LoadingBlock rows={4} /> : !posts.data?.length ? <EmptyState title="No posts yet" description="Start the conversation!" action={<Button onClick={() => setCompose(true)}>Create post</Button>} /> : (
            <ul className="space-y-2">
              {posts.data.map((p) => (
                <li key={p.id}>
                  <button onClick={() => openPost(p.id)} className={cx("cg-card cg-card-hover block w-full !p-4 text-left", p.isHidden && "opacity-60")}>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone="red">{p.category}</Badge>{p.isHidden && <Badge tone="amber">Hidden</Badge>}<span>{p.author}{p.isMine && " (you)"} · {timeAgo(p.createdAt)}</span><span className="ml-auto">💬 {p.comments}</span></div>
                    <h2 className="mt-2 font-bold">{p.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{p.content}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={compose} onClose={() => setCompose(false)} title="New post" wide>
        <div className="space-y-3">
          <Select label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
          <Textarea label="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[180px]" />
          <p className="text-xs text-muted">Don&apos;t share personal information such as phone numbers or addresses.</p>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCompose(false)}>Cancel</Button><Button onClick={createPost} loading={posting}>Publish</Button></div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.post.title ?? ""} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone="red">{detail.post.category}</Badge>{detail.post.isHidden && <Badge tone="amber">Hidden by moderator</Badge>}<span>{detail.post.author} · {timeAgo(detail.post.createdAt)}</span></div>
            <p className="whitespace-pre-wrap text-sm">{detail.post.content}</p>
            <div className="flex flex-wrap gap-2">
              {!detail.post.isMine && <Button size="sm" variant="ghost" onClick={() => setReport({ id: detail.post.id, reason: "" })}>⚑ Report</Button>}
              {(detail.post.isMine || isAdmin) && <Button size="sm" variant="danger" onClick={() => setDel({ kind: "post", id: detail.post.id })}>Delete post</Button>}
              {isAdmin && <Button size="sm" variant="secondary" onClick={() => toggleHidden(detail.post.id, !detail.post.isHidden)}>{detail.post.isHidden ? "Unhide" : "Hide post"}</Button>}
            </div>
            <div className="border-t border-line pt-4">
              <h3 className="mb-3 text-sm font-bold">{detail.comments.length} comment{detail.comments.length !== 1 && "s"}</h3>
              <ul className="space-y-2">
                {detail.comments.map((c) => (
                  <li key={c.id} className="rounded-md bg-surface-2 p-3">
                    <div className="flex items-center justify-between text-xs text-muted"><span>{c.author}{c.isMine && " (you)"} · {timeAgo(c.createdAt)}</span>{(c.isMine || isAdmin) && <button onClick={() => setDel({ kind: "comment", id: c.id })} className="hover:text-red-400">Delete</button>}</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
                  </li>
                ))}
              </ul>
              {!detail.post.isHidden && (
                <div className="mt-3 flex gap-2">
                  <Textarea aria-label="Write a comment" value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-[60px] flex-1" placeholder="Write a comment…" />
                  <Button onClick={addComment} disabled={!comment.trim()}>Reply</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!report} onClose={() => setReport(null)} title="Report post">
        <Textarea label="Reason" value={report?.reason ?? ""} onChange={(e) => setReport(report && { ...report, reason: e.target.value })} placeholder="Spam, harassment, personal data…" />
        <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setReport(null)}>Cancel</Button><Button onClick={submitReport} disabled={(report?.reason.trim().length ?? 0) < 3}>Submit report</Button></div>
      </Modal>
      <ConfirmDialog open={!!del} title={`Delete ${del?.kind}?`} message="This cannot be undone." onConfirm={doDelete} onCancel={() => setDel(null)} />
    </div>
  );
}

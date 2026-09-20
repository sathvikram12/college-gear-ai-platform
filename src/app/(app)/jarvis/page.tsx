"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, errMsg, timeAgo, ApiClientError } from "@/lib/api";
import { useDebounced, qs } from "@/lib/hooks";
import { Button, SearchBar, Badge, ConfirmDialog, AiNotice, useToast, Spinner, cx } from "@/components/ui";
import { Markdown } from "@/components/Markdown";

type Conv = { id: string; title: string; updatedAt: string };
type Structured = { answer: string; summary: string; steps: string[]; resources: { title: string; description: string }[]; confidence: "high" | "medium" | "low"; actions: { label: string; href: string }[] };
type Msg = { id: string; role: "user" | "assistant"; content: string; structured: Structured | null; createdAt: string };

const STARTERS = ["I have a Python interview next week. Help me prepare.", "Explain Big-O notation with examples.", "Make me a 5-day study plan for DBMS exams.", "How do I write a strong resume project description?"];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2" aria-label="Jarvis is thinking">
      {[0, 1, 2].map((i) => <span key={i} className="cg-dot h-2 w-2 rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />)}
      <span className="ml-2 text-xs text-muted">Jarvis is thinking…</span>
    </div>
  );
}

function AIResponse({ s, onCopy }: { s: Structured; onCopy: () => void }) {
  const tone = s.confidence === "high" ? "green" : s.confidence === "medium" ? "amber" : "red";
  return (
    <div className="space-y-3">
      <Markdown text={s.answer} />
      {s.steps.length > 0 && (
        <div className="rounded-md border border-line bg-black/30 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-accent">Step by step</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">{s.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
        </div>
      )}
      {s.resources.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Suggested resources</p>
          <ul className="grid gap-2 sm:grid-cols-2">{s.resources.map((r, i) => <li key={i} className="rounded border border-line p-2 text-xs"><p className="font-semibold text-light">{r.title}</p><p className="text-muted">{r.description}</p></li>)}</ul>
        </div>
      )}
      {s.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {s.actions.map((a, i) => <Link key={i} href={a.href} className="rounded-md border border-blood/60 bg-blood/15 px-3 py-1.5 text-xs font-semibold hover:bg-blood">{a.label} →</Link>)}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-xs text-muted">
        <Badge tone={tone}>Confidence: {s.confidence}</Badge>
        {s.summary && <span className="hidden flex-1 truncate sm:inline">TL;DR: {s.summary}</span>}
        <button onClick={onCopy} className="ml-auto rounded px-2 py-1 hover:bg-white/5 hover:text-white">Copy</button>
      </div>
    </div>
  );
}

function JarvisChat() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("c");
  const [convs, setConvs] = useState<Conv[]>([]);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<{ text: string; error: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "clear" | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  // Id of a conversation send() just created: its messages are already on screen, so skip the reload.
  const justCreated = useRef<string | null>(null);
  const [aiReady, setAiReady] = useState(true);
  useEffect(() => { api<{ ai: boolean }>("/system/status").then((s) => setAiReady(s.ai)).catch(() => {}); }, []);

  const loadConvs = useCallback(async () => {
    try { setConvs(await api<Conv[]>(`/jarvis/conversations${qs({ q })}`)); } catch (e) { toast(errMsg(e), "error"); }
  }, [q, toast]);
  useEffect(() => { void loadConvs(); }, [loadConvs]);

  useEffect(() => {
    setFailed(null);
    if (!activeId) { setMessages([]); return; }
    if (justCreated.current === activeId) { justCreated.current = null; return; }
    setLoadingMsgs(true);
    api<{ messages: Msg[] }>(`/jarvis/conversations/${activeId}`)
      .then((d) => setMessages(d.messages))
      .catch((e) => {
        toast(errMsg(e), "error");
        // "Conversation not found": keep what is already displayed instead of clearing it.
        if (!(e instanceof ApiClientError && e.status === 404)) router.replace("/jarvis");
      })
      .finally(() => setLoadingMsgs(false));
  }, [activeId, router, toast]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending, pending]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setFailed(null);
    setPending(text);
    setInput("");
    try {
      const d = await api<{ conversation: Conv; messages: Msg[] }>("/jarvis/chat", { body: { message: text, conversationId: activeId ?? undefined } });
      setMessages((m) => [...m, ...d.messages]);
      if (!activeId) {
        justCreated.current = d.conversation.id;
        router.replace(`/jarvis?c=${d.conversation.id}`);
      }
      void loadConvs();
    } catch (e) {
      setFailed({ text, error: errMsg(e) });
    } finally {
      setSending(false);
      setPending(null);
    }
  }

  async function doConfirm() {
    if (!activeId) return;
    try {
      if (confirm === "delete") {
        await api(`/jarvis/conversations/${activeId}`, { method: "DELETE" });
        router.replace("/jarvis");
        toast("Conversation deleted");
      } else {
        await api(`/jarvis/conversations/${activeId}/messages`, { method: "DELETE" });
        setMessages([]);
        toast("Conversation cleared");
      }
      void loadConvs();
    } catch (e) { toast(errMsg(e), "error"); }
    setConfirm(null);
  }

  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast("Copied to clipboard"), () => toast("Copy failed", "error"));
  const submit = (e: FormEvent) => { e.preventDefault(); void send(input); };
  const active = convs.find((c) => c.id === activeId);

  return (
    <div className="relative flex h-[calc(100vh-150px)] min-h-[560px] overflow-hidden rounded-xl border border-line bg-surface">
      {/* Conversation list */}
      <aside className={cx("absolute inset-y-0 left-0 z-30 w-[290px] flex-col border-r border-line bg-surface md:static md:flex", sidebar ? "flex" : "hidden")}>
        <div className="space-y-2 border-b border-line p-3">
          <Button className="w-full" onClick={() => { router.push("/jarvis"); setSidebar(false); }}>+ New conversation</Button>
          <SearchBar value={search} onChange={setSearch} placeholder="Search conversations" />
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {convs.length === 0 && <li className="p-4 text-center text-xs text-muted">{q ? "No matches" : "No conversations yet"}</li>}
          {convs.map((c) => (
            <li key={c.id}>
              <button onClick={() => { router.push(`/jarvis?c=${c.id}`); setSidebar(false); }} className={cx("w-full rounded-md px-3 py-2 text-left transition-colors", c.id === activeId ? "bg-blood/20 text-white" : "text-muted hover:bg-white/5 hover:text-light")}>
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="text-[11px] opacity-70">{timeAgo(c.updatedAt)}</p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Chat */}
      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <button className="rounded border border-line px-2 py-1 text-xs md:hidden" onClick={() => setSidebar((v) => !v)} aria-label="Toggle conversations">☰</button>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blood text-sm font-black shadow-[0_0_14px_rgba(193,18,31,0.7)]">J</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold">{active?.title ?? "Jarvis — AI Student Assistant"}</h1>
            <p className="text-[11px] text-muted">Powered by Google Gemini · server-side</p>
          </div>
          {activeId && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setConfirm("clear")}>Clear</Button>
              <Button size="sm" variant="danger" onClick={() => setConfirm("delete")}>Delete</Button>
            </>
          )}
        </header>

        {!aiReady && (
          <div role="status" className="border-b border-amber-900 bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
            AI is not configured on this deployment (missing <code>GEMINI_API_KEY</code> on the server). Jarvis cannot answer until an administrator adds the key.
          </div>
        )}
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite">
          {loadingMsgs && <div className="flex justify-center"><Spinner /></div>}
          {!loadingMsgs && messages.length === 0 && !pending && (
            <div className="mx-auto max-w-xl py-10 text-center">
              <p className="text-4xl font-black">Hi, I&apos;m <span className="text-accent">Jarvis</span>.</p>
              <p className="mt-2 text-sm text-muted">Ask about any subject, study plans, college workflows, careers or interviews. I&apos;ll link you to the right COLLEGE GEAR tools.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-md border border-line p-3 text-left text-sm text-muted transition-colors hover:border-accent/60 hover:text-light">{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cx("cg-fade-up flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[92%] rounded-xl px-4 py-3 sm:max-w-[80%]", m.role === "user" ? "bg-blood/90 text-white" : "border border-line bg-surface-2")}>
                {m.role === "assistant" && m.structured ? <AIResponse s={m.structured} onCopy={() => copy(m.content)} /> : <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-end"><div className="max-w-[80%] rounded-xl bg-blood/60 px-4 py-3 text-sm text-white">{pending}</div></div>
          )}
          {sending && <TypingIndicator />}
          {failed && (
            <div role="alert" className="rounded-md border border-red-900 bg-red-950/30 p-3 text-sm">
              <p className="text-red-300">⚠ {failed.error}</p>
              <p className="mt-1 truncate text-xs text-muted">Your message: “{failed.text}”</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => send(failed.text)}>Retry</Button>
                <Button size="sm" variant="ghost" onClick={() => { setInput(failed.text); setFailed(null); }}>Edit</Button>
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>

        <form onSubmit={submit} className="border-t border-line p-3 sm:p-4">
          <div className="flex items-end gap-2">
            <label htmlFor="jarvis-input" className="sr-only">Message Jarvis</label>
            <textarea
              id="jarvis-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              rows={1}
              maxLength={4000}
              placeholder="Ask Jarvis anything… (Enter to send, Shift+Enter for newline)"
              className="cg-input max-h-40 min-h-[46px] flex-1 resize-none"
            />
            <Button type="submit" size="lg" loading={sending} disabled={!input.trim()}>Send</Button>
          </div>
          <div className="mt-2"><AiNotice>Jarvis can make mistakes and does not know official policies of your college unless provided. Verify important information.</AiNotice></div>
        </form>
      </section>

      <ConfirmDialog open={!!confirm} title={confirm === "delete" ? "Delete conversation?" : "Clear conversation?"} message={confirm === "delete" ? "This permanently deletes the conversation and all messages." : "All messages in this conversation will be removed."} confirmLabel={confirm === "delete" ? "Delete" : "Clear"} onConfirm={doConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}

export default function JarvisPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      <JarvisChat />
    </Suspense>
  );
}

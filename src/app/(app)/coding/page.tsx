"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { api, errMsg, timeAgo, ApiClientError } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button, Input, Select, Textarea, Card, Badge, ConfirmDialog, PageHeader, Spinner, useToast, cx } from "@/components/ui";

const Editor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false, loading: () => <div className="grid h-full place-items-center"><Spinner /></div> });

type Lang = "python" | "javascript" | "java" | "c" | "cpp";
const LANGS: { value: Lang; label: string; monaco: string }[] = [
  { value: "python", label: "Python", monaco: "python" },
  { value: "javascript", label: "JavaScript", monaco: "javascript" },
  { value: "java", label: "Java", monaco: "java" },
  { value: "c", label: "C", monaco: "c" },
  { value: "cpp", label: "C++", monaco: "cpp" },
];
const TEMPLATES: Record<Lang, string> = {
  python: 'def greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("COLLEGE GEAR"))\nprint(sum(i * i for i in range(10)))\n',
  javascript: 'function fib(n) {\n  return n < 2 ? n : fib(n - 1) + fib(n - 2);\n}\n\nconsole.log("Fibonacci:", [...Array(10).keys()].map(fib));\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}\n',
  c: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello from C!\\n");\n    return 0;\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from C++!" << endl;\n    return 0;\n}\n',
};

type Session = { id: string; title: string; language: Lang; updatedAt: string };
type Output = { stdout: string; stderr: string; status: string; ms?: number };

/* ---- Isolated in-browser sandboxes (Web Workers: no DOM, network disabled, hard timeout) ---- */
const JS_WORKER = `
self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.importScripts = undefined; self.indexedDB = undefined;
self.onmessage = (e) => {
  const out = [];
  const fmt = (a) => a.map((x) => { if (typeof x === "string") return x; try { return JSON.stringify(x); } catch { return String(x); } }).join(" ");
  console.log = (...a) => out.push(fmt(a)); console.info = console.log; console.warn = (...a) => out.push("[warn] " + fmt(a)); console.error = (...a) => out.push("[error] " + fmt(a));
  try { (0, eval)(e.data.code); self.postMessage({ stdout: out.join("\\n"), stderr: "" }); }
  catch (err) { self.postMessage({ stdout: out.join("\\n"), stderr: String((err && err.stack) || err) }); }
};`;
const PY_WORKER = `
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");
// Pyodide needs fetch while it downloads its runtime, so disable network access only after it has loaded.
let pyReady = loadPyodide().then((py) => { self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined; return py; });
self.onmessage = async (e) => {
  const out = [], err = [];
  try {
    const py = await pyReady;
    py.setStdout({ batched: (s) => out.push(s) });
    py.setStderr({ batched: (s) => err.push(s) });
    const lines = (e.data.stdin || "").split("\\n");
    py.setStdin({ stdin: () => (lines.length ? lines.shift() : null) });
    // Fresh namespace per run so variables from a previous run never leak into this one.
    const ns = py.toPy({ __name__: "__main__" });
    try { await py.runPythonAsync(e.data.code, { globals: ns }); } finally { ns.destroy(); }
    self.postMessage({ stdout: out.join("\\n"), stderr: err.join("\\n") });
  } catch (x) { self.postMessage({ stdout: out.join("\\n"), stderr: String(x) }); }
};`;

function runInWorker(src: string, payload: { code: string; stdin: string }, timeoutMs: number, keep?: { current: Worker | null }): Promise<Output> {
  return new Promise((resolve) => {
    const worker = keep?.current ?? new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    if (keep) keep.current = worker;
    const t0 = performance.now();
    const timer = setTimeout(() => {
      worker.terminate();
      if (keep) keep.current = null;
      resolve({ stdout: "", stderr: `Execution stopped: exceeded ${timeoutMs / 1000}s time limit (possible infinite loop).`, status: "Time limit exceeded" });
    }, timeoutMs);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      if (!keep) worker.terminate();
      resolve({ ...(e.data as { stdout: string; stderr: string }), status: (e.data as { stderr: string }).stderr ? "Error" : "Success", ms: Math.round(performance.now() - t0) });
    };
    worker.onerror = (e) => { clearTimeout(timer); worker.terminate(); if (keep) keep.current = null; resolve({ stdout: "", stderr: e.message || "Sandbox failed to start", status: "Error" }); };
    worker.postMessage(payload);
  });
}

export default function CodingPage() {
  const toast = useToast();
  const list = useApi<{ sessions: Session[]; serverExecution: boolean }>("/code");
  const [lang, setLang] = useState<Lang>("python");
  const [code, setCode] = useState(TEMPLATES.python);
  const [title, setTitle] = useState("Untitled");
  const [stdin, setStdin] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Session | null>(null);
  const pyWorker = useRef<Worker | null>(null);

  useEffect(() => () => pyWorker.current?.terminate(), []);

  function changeLang(l: Lang) {
    const isTemplate = Object.values(TEMPLATES).includes(code) || !code.trim();
    setLang(l);
    if (isTemplate) setCode(TEMPLATES[l]);
  }

  async function run() {
    setRunning(true);
    setOutput(null);
    try {
      if (lang === "javascript") setOutput(await runInWorker(JS_WORKER, { code, stdin }, 5000));
      else if (lang === "python") setOutput(await runInWorker(PY_WORKER, { code, stdin }, pyWorker.current ? 10000 : 45000, pyWorker));
      else {
        const r = await api<{ stdout: string; stderr: string; status: string }>("/code/run", { body: { language: lang, code, stdin } });
        setOutput(r);
      }
    } catch (e) {
      setOutput({ stdout: "", stderr: e instanceof ApiClientError && e.code === "EXECUTION_DISABLED" ? e.message : errMsg(e), status: e instanceof ApiClientError && e.code === "EXECUTION_DISABLED" ? "Execution unavailable" : "Error" });
    } finally { setRunning(false); }
  }

  async function save() {
    setSaving(true);
    try {
      const body = { title: title.trim() || "Untitled", language: lang, code, lastOutput: output ? [output.stdout, output.stderr].filter(Boolean).join("\n").slice(0, 20000) : null };
      const s = await api<Session>(current ? `/code/${current}` : "/code", { method: current ? "PUT" : "POST", body });
      setCurrent(s.id); toast("Code saved"); void list.reload();
    } catch (e) { toast(errMsg(e), "error"); } finally { setSaving(false); }
  }
  async function load(id: string) {
    try {
      const s = await api<{ id: string; title: string; language: Lang; code: string; lastOutput: string | null }>(`/code/${id}`);
      setCurrent(s.id); setTitle(s.title); setLang(s.language); setCode(s.code);
      setOutput(s.lastOutput ? { stdout: s.lastOutput, stderr: "", status: "Last saved output" } : null);
    } catch (e) { toast(errMsg(e), "error"); }
  }
  async function remove() {
    if (!del) return;
    try { await api(`/code/${del.id}`, { method: "DELETE" }); if (current === del.id) newFile(); toast("Deleted"); void list.reload(); } catch (e) { toast(errMsg(e), "error"); }
    setDel(null);
  }
  function newFile() { setCurrent(null); setTitle("Untitled"); setCode(TEMPLATES[lang]); setOutput(null); }

  const compiled = lang === "java" || lang === "c" || lang === "cpp";
  const serverExec = list.data?.serverExecution;

  return (
    <div>
      <PageHeader eyebrow="Build" title="Coding Lab" subtitle="Write, run and save code in Python, JavaScript, Java, C and C++." actions={<><Button variant="secondary" onClick={newFile}>New file</Button><Button variant="secondary" onClick={() => setCode("")}>Clear</Button><Button variant="secondary" onClick={save} loading={saving}>{current ? "Save" : "Save as new"}</Button><Button onClick={run} loading={running}>▶ Run</Button></>} />
      <div className="grid gap-4 xl:grid-cols-[240px_1fr_380px]">
        <aside className="order-3 xl:order-1">
          <Card className="!p-3">
            <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">Saved sessions</p>
            {list.loading && !list.data ? <Spinner /> : list.data?.sessions.length ? (
              <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
                {list.data.sessions.map((s) => (
                  <li key={s.id} className={cx("group flex items-center rounded-md", current === s.id ? "bg-blood/20" : "hover:bg-white/5")}>
                    <button onClick={() => load(s.id)} className="min-w-0 flex-1 px-2 py-1.5 text-left">
                      <p className="truncate text-sm font-medium">{s.title}</p>
                      <p className="text-[11px] text-muted">{s.language} · {timeAgo(s.updatedAt)}</p>
                    </button>
                    <button onClick={() => setDel(s)} className="px-2 text-xs text-muted opacity-60 hover:text-red-400 group-hover:opacity-100" aria-label={`Delete ${s.title}`}>✕</button>
                  </li>
                ))}
              </ul>
            ) : <p className="px-1 text-xs text-muted">No saved code yet.</p>}
          </Card>
        </aside>
        <section className="order-1 space-y-3 xl:order-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label="File title" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
            <Select aria-label="Language" value={lang} onChange={(e) => changeLang(e.target.value as Lang)} className="sm:w-40">{LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</Select>
          </div>
          <div className="h-[520px] overflow-hidden rounded-lg border border-line bg-[#1e1e1e]">
            <Editor height="100%" theme="vs-dark" language={LANGS.find((l) => l.value === lang)?.monaco} value={code} onChange={(v) => setCode(v ?? "")} options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4 }} />
          </div>
        </section>
        <aside className="order-2 space-y-3 xl:order-3">
          {compiled && !serverExec && (
            <div className="rounded-md border border-amber-900 bg-amber-950/30 p-3 text-xs text-amber-200">
              <b>Server execution disabled.</b> For security, student code is never executed on the main backend. Java/C/C++ run only through an isolated Judge0 sandbox, which is not configured on this deployment. You can still edit and save code.
            </div>
          )}
          {!compiled && <p className="rounded-md border border-line bg-surface p-3 text-xs text-muted"><Badge tone="green">Sandboxed</Badge> {lang === "python" ? "Python runs via Pyodide (WebAssembly) in an isolated Web Worker in your browser. First run downloads the runtime (~10 MB)." : "JavaScript runs in an isolated Web Worker in your browser (no DOM, no network, 5s limit)."}</p>}
          <Textarea label="Standard input (stdin)" value={stdin} onChange={(e) => setStdin(e.target.value)} className="min-h-[70px] font-mono text-xs" placeholder={lang === "javascript" ? "stdin not used for JavaScript" : "Input lines…"} />
          <div className="rounded-lg border border-line bg-black">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Output</p>
              {output && <Badge tone={output.status === "Success" || output.status === "Accepted" ? "green" : output.status.includes("unavailable") || output.status.includes("saved") ? "amber" : "red"}>{output.status}{output.ms !== undefined ? ` · ${output.ms}ms` : ""}</Badge>}
            </div>
            <div className="max-h-[380px] min-h-[200px] overflow-auto p-3 font-mono text-[13px]" aria-live="polite">
              {running ? <p className="flex items-center gap-2 text-muted"><Spinner size={14} /> Running…</p> : !output ? <p className="text-muted/60">Press ▶ Run to execute.</p> : (
                <>
                  {output.stdout && <pre className="whitespace-pre-wrap text-light">{output.stdout}</pre>}
                  {output.stderr && <pre className="mt-2 whitespace-pre-wrap text-red-400">{output.stderr}</pre>}
                  {!output.stdout && !output.stderr && <p className="text-muted">(no output)</p>}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
      <ConfirmDialog open={!!del} title="Delete code session?" message={`"${del?.title}" will be permanently deleted.`} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}

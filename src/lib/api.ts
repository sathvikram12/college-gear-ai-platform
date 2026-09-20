"use client";

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

/**
 * Workspace token kept in localStorage and sent as a header, so saved data stays reachable when the
 * browser refuses the workspace cookie (e.g. the site shown inside an embedded preview frame).
 * The server only uses it when the cookie is missing.
 */
const WORKSPACE_KEY = "cg_workspace_token";
let memoryToken: string | null = null;
function workspaceToken(): string {
  const make = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  try {
    let t = localStorage.getItem(WORKSPACE_KEY);
    if (!t) { t = make(); localStorage.setItem(WORKSPACE_KEY, t); }
    return t;
  } catch {
    return (memoryToken ??= make()); // storage blocked: keep one token for this page session
  }
}

/** Thin fetch wrapper for the COLLEGE GEAR REST API. Cookies carry the httpOnly session. */
export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"), credentials: "same-origin", signal: opts.signal, headers: { "X-Workspace-Token": workspaceToken() } };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { ...(init.headers as Record<string, string>), "Content-Type": "application/json" };
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, "NETWORK_ERROR", "Network error — check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: { code: string; message: string; details?: unknown } } | null;
  if (!res.ok || !json?.success) {
    throw new ApiClientError(res.status, json?.error?.code ?? "UNKNOWN", json?.error?.message ?? `Request failed (${res.status})`, json?.error?.details);
  }
  return json.data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function timeAgo(d: string | Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString();
}

export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const titleCase = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

import type { NextRequest } from "next/server";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type Ctx = {
  req: NextRequest;
  params: Record<string, string>;
  query: URLSearchParams;
  ip: string;
};
export type Handler = (ctx: Ctx) => Promise<Response>;
export type Route = { method: Method; pattern: string; segments: string[]; handler: Handler };

/** Express-style route definition helper. Patterns are relative to /api, e.g. "/notes/:id". */
export function route(method: Method, pattern: string, handler: Handler): Route {
  return { method, pattern, segments: pattern.split("/").filter(Boolean), handler };
}

export function matchRoute(routes: Route[], method: string, path: string) {
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  let best: { route: Route; params: Record<string, string>; score: number } | null = null;
  let pathMatched = false;
  for (const r of routes) {
    if (r.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let score = 0;
    let okMatch = true;
    for (let i = 0; i < parts.length; i++) {
      const seg = r.segments[i];
      if (seg.startsWith(":")) params[seg.slice(1)] = parts[i];
      else if (seg === parts[i]) score++;
      else {
        okMatch = false;
        break;
      }
    }
    if (!okMatch) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    if (!best || score > best.score) best = { route: r, params, score };
  }
  return { match: best, pathMatched };
}

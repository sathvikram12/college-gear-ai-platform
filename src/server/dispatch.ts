import type { NextRequest } from "next/server";
import { matchRoute, type Route } from "./router";
import { fail, getIp, handleError, rateLimit } from "./http";
import { ensureSeeded } from "./seed";
import { accountRoutes } from "./routes/account";
import { studyRoutes } from "./routes/study";
import { practiceRoutes } from "./routes/practice";
import { workspaceRoutes } from "./routes/workspace";
import { careerRoutes } from "./routes/career";
import { contentRoutes } from "./routes/content";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";

const routes: Route[] = [...accountRoutes, ...studyRoutes, ...practiceRoutes, ...workspaceRoutes, ...careerRoutes, ...contentRoutes, ...adminRoutes, ...authRoutes];

/** Express-style front controller: global rate limit → CSRF check → route match → handler → centralised errors. */
export async function dispatch(req: NextRequest) {
  try {
    const ip = getIp(req);
    rateLimit(`global:${ip}`, 600, 60_000);
    const path = req.nextUrl.pathname.replace(/^\/api/, "") || "/";
    const { match, pathMatched } = matchRoute(routes, req.method, path);
    if (!match) {
      return pathMatched ? fail(405, "METHOD_NOT_ALLOWED", `${req.method} is not supported for this endpoint`) : fail(404, "NOT_FOUND", "API endpoint not found");
    }
    // CSRF defence for cookie-authenticated mutations: require same-origin (or explicitly allowed) requests.
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      const allowed = (process.env.CLIENT_URL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (origin && host && origin !== "null") {
        let originHost = "";
        try {
          originHost = new URL(origin).host;
        } catch {
          /* invalid origin */
        }
        if (originHost !== host && !allowed.includes(origin)) return fail(403, "CSRF_BLOCKED", "Cross-origin request blocked");
      }
    }
    await ensureSeeded();
    return await match.route.handler({ req, params: match.params, query: req.nextUrl.searchParams, ip });
  } catch (err) {
    return handleError(err);
  }
}

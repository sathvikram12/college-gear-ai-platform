/**
 * End-to-end API tests against a running server (no login — anonymous browser workspaces).
 *   E2E_BASE_URL=http://localhost:3000 npm test
 * Skipped automatically when E2E_BASE_URL is not set.
 */
import { describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL?.startsWith("http") ? process.env.E2E_BASE_URL : undefined;
const d = BASE ? describe : describe.skip;

/** Simulates one browser (cookie jar). */
class Browser {
  cookies = new Map<string, string>();
  async req(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      redirect: "manual",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: body ? JSON.stringify(body) : undefined,
    });
    this.store(res);
    return { status: res.status, json: (await res.json().catch(() => null)) as { success: boolean; data: any; error?: { code: string } } };
  }
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (v) this.cookies.set(k, v); else this.cookies.delete(k);
    }
  }
  async page(path: string) {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual", headers: { Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") } });
    this.store(res);
    return res;
  }
}

d("COLLEGE GEAR (no login)", () => {
  const a = new Browser();

  it("health check", async () => {
    expect((await fetch(`${BASE}/api/health`).then((x) => x.json())).success).toBe(true);
  });

  it("pages open directly without redirects and set a workspace cookie", async () => {
    for (const p of ["/", "/dashboard", "/notes", "/jarvis", "/quizzes", "/admin"]) {
      const r = await a.page(p);
      expect(r.status).toBe(200);
    }
    expect(a.cookies.get("cg_workspace")).toBeTruthy();
    for (const p of ["/login", "/signup"]) expect((await a.page(p)).status).toBe(200); // optional account pages
  });

  it("optional accounts: register → auto-login → logout → login → isolation", async () => {
    const email = `e2e_${Date.now()}@test.dev`;
    const u = new Browser();
    expect((await u.req("GET", "/auth/session")).json.data.authenticated).toBe(false);
    expect((await u.req("GET", "/auth/me")).status).toBe(401);
    const reg = await u.req("POST", "/auth/register", { name: "E2E User", email: email.toUpperCase(), password: "Passw0rd1", confirmPassword: "Passw0rd1" });
    expect(reg.status).toBe(201);
    expect((await u.req("GET", "/auth/me")).json.data.user.email).toBe(email); // signed in without a second login
    expect((await u.req("POST", "/auth/register", { name: "Dup", email, password: "Passw0rd1", confirmPassword: "Passw0rd1" })).status).toBe(400);
    expect((await new Browser().req("POST", "/auth/register", { name: "Dup", email, password: "Passw0rd1", confirmPassword: "Passw0rd1" })).status).toBe(409);
    const note = await u.req("POST", "/notes", { title: "Account note", content: "mine" });
    expect((await u.req("POST", "/auth/logout")).status).toBe(200);
    expect((await u.req("GET", "/auth/me")).status).toBe(401);
    expect((await u.req("GET", `/notes/${note.json.data.id}`)).status).toBe(404); // public visitor can't see account data
    expect((await u.req("POST", "/auth/login", { email, password: "wrong-pass1" })).status).toBe(401);
    expect((await u.req("POST", "/auth/login", { email: ` ${email} `, password: "Passw0rd1" })).status).toBe(200);
    expect((await u.req("GET", `/notes/${note.json.data.id}`)).json.data.title).toBe("Account note");
    await u.req("POST", "/auth/logout");
  });

  it("parallel first requests share one workspace", async () => {
    const b = new Browser();
    await b.page("/dashboard");
    const ids = await Promise.all([1, 2, 3].map(() => b.req("GET", "/workspace").then((r) => r.json.data.user.id)));
    expect(new Set(ids).size).toBe(1);
  });

  it("features work without an account and data persists", async () => {
    const note = await a.req("POST", "/notes", { title: "No-login note", content: "Paging", tags: ["os"] });
    expect(note.status).toBe(201);
    expect((await a.req("GET", "/notes")).json.data.notes.some((n: { id: string }) => n.id === note.json.data.id)).toBe(true);
    expect((await a.req("PUT", "/profile", { name: "Demo Student", department: "CSE" })).json.data.name).toBe("Demo Student");
    const sch = await a.req("POST", "/schedule", { subject: "DS", day: 1, startTime: "09:00", endTime: "10:00" });
    expect(sch.status).toBe(201);
    const quiz = (await a.req("GET", "/quizzes")).json.data[0];
    const start = await a.req("GET", `/quizzes/${quiz.id}`);
    const answers = start.json.data.questions.map((q: { id: string; options: { id: string }[] }) => ({ questionId: q.id, optionId: q.options[0].id }));
    const att = await a.req("POST", `/quizzes/${quiz.id}/attempts`, { answers, durationSeconds: 20 });
    expect(att.json.data.attempt.score).toBe(att.json.data.review.filter((x: { isCorrect: boolean }) => x.isCorrect).length);
    const cats = (await a.req("GET", "/forum/categories")).json.data;
    const post = await a.req("POST", "/forum/posts", { categoryId: cats[0].id, title: "Hello campus", content: "First post without login" });
    expect(post.status).toBe(201);
    expect((await a.req("DELETE", `/forum/posts/${post.json.data.id}`)).status).toBe(200);
    for (const p of ["/dashboard", "/interviews/categories", "/code", "/resume", "/career/profile", "/placements", "/news", "/announcements", "/resources", "/assignments", "/cover-letter", "/jarvis/conversations"]) {
      expect((await a.req("GET", p)).status, p).toBe(200);
    }
    // Admin tools follow the ADMIN_PANEL_ENABLED setting (403 ADMIN_DISABLED when switched off).
    expect([200, 403]).toContain((await a.req("GET", "/admin/analytics")).status);
  });

  it("each browser's workspace is private", async () => {
    const other = new Browser();
    const mine = (await a.req("GET", "/notes")).json.data.notes[0];
    expect((await other.req("GET", `/notes/${mine.id}`)).status).toBe(404);
    expect((await other.req("DELETE", `/notes/${mine.id}`)).status).toBe(404);
    expect((await other.req("GET", "/notes")).json.data.notes.length).toBe(0);
  });

  it("returns consistent 404 envelope", async () => {
    const r = await a.req("GET", "/does-not-exist");
    expect(r).toMatchObject({ status: 404, json: { success: false, error: { code: "NOT_FOUND" } } });
  });
});

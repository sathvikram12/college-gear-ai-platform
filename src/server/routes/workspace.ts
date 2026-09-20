import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduleEntries, reminders, codingSessions, assignments, assignmentSubmissions } from "@/db/schema";
import { route } from "../router";
import { ok, parseBody, rateLimit, audit, Errors, ApiError } from "../http";
import { requireUser } from "../auth";
import { scheduleSchema, reminderSchema, codeSchema, codeRunSchema, assignmentMetaSchema, uuidSchema } from "../schemas";
import { buildIcs } from "../logic";
import { assignmentAnalysisService } from "../ai/services";

const maxUploadBytes = () => Math.max(1, Number(process.env.UPLOAD_MAX_SIZE_MB || 10)) * 1024 * 1024;

async function extractText(file: File): Promise<{ text: string; mime: string }> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".pdf")) {
    if (buf.toString("ascii", 0, 4) !== "%PDF") throw Errors.badRequest("File content is not a valid PDF");
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: true });
    return { text: String(text), mime: "application/pdf" };
  }
  if (name.endsWith(".docx")) {
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw Errors.badRequest("File content is not a valid DOCX");
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer: buf });
    return { text: res.value, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  if (name.endsWith(".txt")) {
    if (buf.includes(0)) throw Errors.badRequest("Text file contains binary data");
    return { text: new TextDecoder("utf-8").decode(buf), mime: "text/plain" };
  }
  throw Errors.badRequest("Only PDF, DOCX and TXT files are supported");
}

const JUDGE0_LANG: Record<string, number> = { python: 71, javascript: 63, java: 62, c: 50, cpp: 54 };

export const workspaceRoutes = [
  /* ================= Schedule ================= */
  route("GET", "/schedule", async () => {
    const u = await requireUser();
    const [entries, rem] = await Promise.all([
      db.select().from(scheduleEntries).where(eq(scheduleEntries.userId, u.id)).orderBy(asc(scheduleEntries.day), asc(scheduleEntries.startTime)),
      db.select().from(reminders).where(eq(reminders.userId, u.id)).orderBy(asc(reminders.done), asc(reminders.remindAt)),
    ]);
    return ok({ entries, reminders: rem });
  }),
  route("POST", "/schedule", async ({ req }) => {
    const u = await requireUser();
    const b = await parseBody(req, scheduleSchema);
    const [e] = await db.insert(scheduleEntries).values({ ...b, userId: u.id }).returning();
    return ok(e, 201);
  }),
  route("PUT", "/schedule/:id", async ({ req, params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const b = await parseBody(req, scheduleSchema);
    const [e] = await db.update(scheduleEntries).set(b).where(and(eq(scheduleEntries.id, params.id), eq(scheduleEntries.userId, u.id))).returning();
    if (!e) throw Errors.notFound("Schedule entry not found");
    return ok(e);
  }),
  route("DELETE", "/schedule/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const r = await db.delete(scheduleEntries).where(and(eq(scheduleEntries.id, params.id), eq(scheduleEntries.userId, u.id))).returning({ id: scheduleEntries.id });
    if (!r.length) throw Errors.notFound("Schedule entry not found");
    return ok({ deleted: true });
  }),
  route("GET", "/schedule/export.ics", async () => {
    const u = await requireUser();
    const entries = await db.select().from(scheduleEntries).where(eq(scheduleEntries.userId, u.id));
    return new Response(buildIcs(entries), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="college-gear-schedule.ics"' },
    });
  }),
  route("POST", "/reminders", async ({ req }) => {
    const u = await requireUser();
    const b = await parseBody(req, reminderSchema);
    const [r] = await db.insert(reminders).values({ userId: u.id, title: b.title, note: b.note, remindAt: new Date(b.remindAt), done: b.done }).returning();
    return ok(r, 201);
  }),
  route("PUT", "/reminders/:id", async ({ req, params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const b = await parseBody(req, reminderSchema);
    const [r] = await db.update(reminders).set({ title: b.title, note: b.note, remindAt: new Date(b.remindAt), done: b.done }).where(and(eq(reminders.id, params.id), eq(reminders.userId, u.id))).returning();
    if (!r) throw Errors.notFound("Reminder not found");
    return ok(r);
  }),
  route("DELETE", "/reminders/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    await db.delete(reminders).where(and(eq(reminders.id, params.id), eq(reminders.userId, u.id)));
    return ok({ deleted: true });
  }),

  /* ================= Coding ================= */
  route("GET", "/code", async () => {
    const u = await requireUser();
    const rows = await db
      .select({ id: codingSessions.id, title: codingSessions.title, language: codingSessions.language, updatedAt: codingSessions.updatedAt })
      .from(codingSessions)
      .where(eq(codingSessions.userId, u.id))
      .orderBy(desc(codingSessions.updatedAt));
    return ok({ sessions: rows, serverExecution: !!process.env.JUDGE0_URL });
  }),
  route("POST", "/code", async ({ req }) => {
    const u = await requireUser();
    const b = await parseBody(req, codeSchema);
    const [s] = await db.insert(codingSessions).values({ userId: u.id, title: b.title, language: b.language, code: b.code, lastOutput: b.lastOutput ?? null }).returning();
    return ok(s, 201);
  }),
  route("GET", "/code/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const [s] = await db.select().from(codingSessions).where(and(eq(codingSessions.id, params.id), eq(codingSessions.userId, u.id)));
    if (!s) throw Errors.notFound("Code session not found");
    return ok(s);
  }),
  route("PUT", "/code/:id", async ({ req, params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const b = await parseBody(req, codeSchema);
    const [s] = await db.update(codingSessions).set({ title: b.title, language: b.language, code: b.code, lastOutput: b.lastOutput ?? null }).where(and(eq(codingSessions.id, params.id), eq(codingSessions.userId, u.id))).returning();
    if (!s) throw Errors.notFound("Code session not found");
    return ok(s);
  }),
  route("DELETE", "/code/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    await db.delete(codingSessions).where(and(eq(codingSessions.id, params.id), eq(codingSessions.userId, u.id)));
    return ok({ deleted: true });
  }),
  /**
   * Server-side execution is delegated to an isolated external sandbox (Judge0) when JUDGE0_URL is set.
   * Student code is NEVER executed inside this Node.js process.
   */
  route("POST", "/code/run", async ({ req }) => {
    const u = await requireUser();
    rateLimit(`run:${u.id}`, 20, 60_000);
    const b = await parseBody(req, codeRunSchema);
    const base = process.env.JUDGE0_URL;
    if (!base) throw new ApiError(501, "EXECUTION_DISABLED", "Secure server-side execution is not configured. JavaScript and Python run in an isolated browser sandbox; Java/C/C++ require a Judge0 sandbox (JUDGE0_URL).");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.JUDGE0_API_KEY) {
      headers["X-RapidAPI-Key"] = process.env.JUDGE0_API_KEY;
      headers["X-RapidAPI-Host"] = new URL(base).host;
    }
    const res = await fetch(`${base.replace(/\/$/, "")}/submissions?base64_encoded=false&wait=true`, {
      method: "POST",
      headers,
      body: JSON.stringify({ language_id: JUDGE0_LANG[b.language], source_code: b.code, stdin: b.stdin, cpu_time_limit: 5, memory_limit: 128000 }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!res || !res.ok) throw new ApiError(502, "EXECUTION_FAILED", "The code execution sandbox is unavailable right now.");
    const j = (await res.json()) as { stdout?: string; stderr?: string; compile_output?: string; status?: { description?: string }; time?: string };
    return ok({ stdout: j.stdout ?? "", stderr: [j.compile_output, j.stderr].filter(Boolean).join("\n"), status: j.status?.description ?? "Unknown", time: j.time ?? null });
  }),

  /* ================= Assignments ================= */
  route("POST", "/assignments/upload", async ({ req, ip }) => {
    const u = await requireUser();
    rateLimit(`upload:${u.id}`, 10, 60 * 60_000);
    const len = Number(req.headers.get("content-length") || 0);
    if (len > maxUploadBytes() + 64 * 1024) throw Errors.badRequest(`File exceeds ${process.env.UPLOAD_MAX_SIZE_MB || 10} MB limit`);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw Errors.badRequest("Attach a file in the 'file' field");
    const meta = assignmentMetaSchema.parse({ title: String(form?.get("title") ?? "") || file.name, question: String(form?.get("question") ?? ""), fileName: file.name, size: file.size });
    if (meta.size > maxUploadBytes()) throw Errors.badRequest(`File exceeds ${process.env.UPLOAD_MAX_SIZE_MB || 10} MB limit`);

    let text: string, mime: string;
    try {
      ({ text, mime } = await extractText(file));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw Errors.badRequest("Could not read text from this file. It may be corrupted, encrypted, or scanned images only.");
    }
    text = text.replace(/\s+\n/g, "\n").trim();
    if (text.length < 50) throw Errors.badRequest("Not enough readable text was found in this file (minimum 50 characters)");

    const [a] = await db
      .insert(assignments)
      .values({ userId: u.id, title: meta.title, question: meta.question, fileName: meta.fileName.slice(0, 255), mimeType: mime, sizeBytes: meta.size, extractedChars: text.length })
      .returning();
    try {
      const report = await assignmentAnalysisService(meta.title, meta.question, text);
      const [sub] = await db.insert(assignmentSubmissions).values({ assignmentId: a.id, userId: u.id, score: Math.round(report.score), report }).returning();
      await audit(u.id, "ai.assignment_analysis", { entity: "assignment", entityId: a.id, ip });
      return ok({ assignment: a, submission: sub }, 201);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Analysis failed";
      const [sub] = await db.insert(assignmentSubmissions).values({ assignmentId: a.id, userId: u.id, error: msg }).returning();
      return ok({ assignment: a, submission: sub }, 201);
    }
  }),
  route("GET", "/assignments", async () => {
    const u = await requireUser();
    const rows = await db.select().from(assignments).where(eq(assignments.userId, u.id)).orderBy(desc(assignments.createdAt));
    const subs = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.userId, u.id)).orderBy(desc(assignmentSubmissions.createdAt));
    return ok(rows.map((r) => ({ ...r, latest: subs.find((s) => s.assignmentId === r.id) ?? null })));
  }),
  route("GET", "/assignments/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const [a] = await db.select().from(assignments).where(and(eq(assignments.id, params.id), eq(assignments.userId, u.id)));
    if (!a) throw Errors.notFound("Assignment not found");
    const subs = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, a.id)).orderBy(desc(assignmentSubmissions.createdAt));
    return ok({ assignment: a, submissions: subs });
  }),
  route("DELETE", "/assignments/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    await db.delete(assignments).where(and(eq(assignments.id, params.id), eq(assignments.userId, u.id)));
    return ok({ deleted: true });
  }),
];

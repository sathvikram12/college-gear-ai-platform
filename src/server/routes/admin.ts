/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, count, desc, eq, gt, ilike, inArray, like, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import {
  users, quizzes, quizQuestions, quizOptions, quizAttempts, news, announcements, placementStats, resources,
  interviewQuestions, interviewCategories, interviewSessions, notes, assignments, forumPosts, forumReports, auditLogs, jarvisMessages,
} from "@/db/schema";
import { route, type Route } from "../router";
import { ok, parseBody, audit, Errors } from "../http";
import { requireAdminPanel } from "../auth";
import {
  adminQuizSchema, adminQuestionSchema, adminNewsSchema, adminAnnouncementSchema, adminPlacementSchema, adminResourceSchema,
  adminInterviewQuestionSchema, adminUserSchema, adminGenerateQuestionsSchema, uuidSchema,
} from "../schemas";
import { quizGenerationService } from "../ai/services";

const admin = () => requireAdminPanel();

/** Generic role-protected CRUD factory for simple content tables. */
function crud(path: string, table: any, schema: z.ZodTypeAny, opts: { orderBy: any; map?: (b: any, adminId: string) => any }): Route[] {
  return [
    route("GET", `/admin/${path}`, async () => {
      await admin();
      return ok(await db.select().from(table).orderBy(opts.orderBy).limit(500));
    }),
    route("POST", `/admin/${path}`, async ({ req, ip }) => {
      const a = await admin();
      const b = await parseBody(req, schema);
      const row = ((await db.insert(table).values(opts.map ? opts.map(b, a.id) : b).returning()) as any[])[0];
      await audit(a.id, `admin.${path}.create`, { entity: path, entityId: (row as any).id, ip });
      return ok(row, 201);
    }),
    route("PUT", `/admin/${path}/:id`, async ({ req, params, ip }) => {
      const a = await admin();
      uuidSchema.parse(params.id);
      const b = await parseBody(req, schema);
      const row = ((await db.update(table).set(opts.map ? opts.map(b, a.id) : b).where(eq(table.id, params.id)).returning()) as any[])[0];
      if (!row) throw Errors.notFound();
      await audit(a.id, `admin.${path}.update`, { entity: path, entityId: params.id, ip });
      return ok(row);
    }),
    route("DELETE", `/admin/${path}/:id`, async ({ params, ip }) => {
      const a = await admin();
      uuidSchema.parse(params.id);
      const r = (await db.delete(table).where(eq(table.id, params.id)).returning()) as any[];
      if (!r.length) throw Errors.notFound();
      await audit(a.id, `admin.${path}.delete`, { entity: path, entityId: params.id, ip });
      return ok({ deleted: true });
    }),
  ];
}

async function questionsWithOptions(where: any) {
  const qs = await db.select().from(quizQuestions).where(where).orderBy(desc(quizQuestions.createdAt)).limit(500);
  const opts = qs.length ? await db.select().from(quizOptions).where(inArray(quizOptions.questionId, qs.map((q) => q.id))).orderBy(asc(quizOptions.position)) : [];
  return qs.map((q) => ({ ...q, options: opts.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })) }));
}

export const adminRoutes: Route[] = [
  /* ---------------- Analytics ---------------- */
  route("GET", "/admin/analytics", async () => {
    await admin();
    const since7 = new Date(Date.now() - 7 * 86400_000);
    const c = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
    const [students, faculty, admins, attempts, aiRequests, activeUsers, notesN, interviewsN, assignmentsN, postsN, openReports, jarvisN] = await Promise.all([
      c(db.select({ n: count() }).from(users).where(eq(users.role, "student"))),
      c(db.select({ n: count() }).from(users).where(eq(users.role, "faculty"))),
      c(db.select({ n: count() }).from(users).where(eq(users.role, "admin"))),
      c(db.select({ n: count() }).from(quizAttempts)),
      c(db.select({ n: count() }).from(auditLogs).where(like(auditLogs.action, "ai.%"))),
      c(db.select({ n: count() }).from(users).where(gt(users.lastLoginAt, since7))),
      c(db.select({ n: count() }).from(notes)),
      c(db.select({ n: count() }).from(interviewSessions)),
      c(db.select({ n: count() }).from(assignments)),
      c(db.select({ n: count() }).from(forumPosts)),
      c(db.select({ n: count() }).from(forumReports).where(eq(forumReports.status, "open"))),
      c(db.select({ n: count() }).from(jarvisMessages).where(eq(jarvisMessages.role, "assistant"))),
    ]);
    const aiByType = await db.select({ action: auditLogs.action, n: count() }).from(auditLogs).where(like(auditLogs.action, "ai.%")).groupBy(auditLogs.action).orderBy(desc(count()));
    const daily = await db.execute<{ day: string; signups: number; attempts: number; ai: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
        (select count(*)::int from users u where u.created_at::date = d::date) as signups,
        (select count(*)::int from quiz_attempts q where q.created_at::date = d::date) as attempts,
        (select count(*)::int from audit_logs a where a.action like 'ai.%' and a.created_at::date = d::date) as ai
      from generate_series(now()::date - interval '13 days', now()::date, interval '1 day') d`);
    const recentAudit = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(15);
    return ok({
      totals: { students, faculty, admins, attempts, aiRequests, activeUsers, notes: notesN, interviews: interviewsN, assignments: assignmentsN, posts: postsN, openReports, jarvisResponses: jarvisN },
      aiByType: aiByType.map((r) => ({ action: r.action, n: Number(r.n) })),
      daily: daily.rows,
      recentAudit,
    });
  }),

  /* ---------------- Users ---------------- */
  route("GET", "/admin/users", async ({ query }) => {
    await admin();
    const q = query.get("q")?.trim();
    const rows = await db
      .select({ id: users.id, name: users.name, role: users.role, isActive: users.isActive, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
      .from(users)
      .where(q ? ilike(users.name, `%${q}%`) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(500);
    return ok(rows);
  }),
  route("PUT", "/admin/users/:id", async ({ req, params, ip }) => {
    const a = await admin();
    uuidSchema.parse(params.id);
    const b = await parseBody(req, adminUserSchema);
    if (params.id === a.id && !b.isActive) throw Errors.badRequest("You cannot disable your own workspace");
    const [row] = await db.update(users).set(b).where(eq(users.id, params.id)).returning({ id: users.id, name: users.name, role: users.role, isActive: users.isActive });
    if (!row) throw Errors.notFound("User not found");
    await audit(a.id, "admin.user.update", { entity: "user", entityId: params.id, metadata: b, ip });
    return ok(row);
  }),

  /* ---------------- Quizzes ---------------- */
  route("GET", "/admin/quizzes", async () => {
    await admin();
    const rows = await db
      .select({ id: quizzes.id, title: quizzes.title, category: quizzes.category, description: quizzes.description, timeLimitSeconds: quizzes.timeLimitSeconds, questionCount: quizzes.questionCount, isActive: quizzes.isActive, bank: count(quizQuestions.id), createdAt: quizzes.createdAt })
      .from(quizzes)
      .leftJoin(quizQuestions, eq(quizQuestions.quizId, quizzes.id))
      .groupBy(quizzes.id)
      .orderBy(asc(quizzes.title));
    return ok(rows.map((r) => ({ ...r, bank: Number(r.bank) })));
  }),
  ...crud("quizzes", quizzes, adminQuizSchema, { orderBy: asc(quizzes.title) }).filter((r) => r.method !== "GET"),

  /* ---------------- Questions ---------------- */
  route("GET", "/admin/questions", async ({ query }) => {
    await admin();
    const quizId = query.get("quizId");
    const q = query.get("q")?.trim();
    const conds = [];
    if (quizId) conds.push(eq(quizQuestions.quizId, uuidSchema.parse(quizId)));
    if (q) conds.push(ilike(quizQuestions.question, `%${q}%`));
    return ok(await questionsWithOptions(conds.length ? and(...conds) : undefined));
  }),
  route("POST", "/admin/questions", async ({ req, ip }) => {
    const a = await admin();
    const b = await parseBody(req, adminQuestionSchema);
    const [q] = await db.insert(quizQuestions).values({ quizId: b.quizId, question: b.question, explanation: b.explanation, difficulty: b.difficulty, isArchived: b.isArchived }).returning();
    await db.insert(quizOptions).values(b.options.map((o, i) => ({ questionId: q.id, text: o.text, isCorrect: o.isCorrect, position: i })));
    await audit(a.id, "admin.questions.create", { entity: "quiz_question", entityId: q.id, ip });
    return ok((await questionsWithOptions(eq(quizQuestions.id, q.id)))[0], 201);
  }),
  route("PUT", "/admin/questions/:id", async ({ req, params, ip }) => {
    const a = await admin();
    uuidSchema.parse(params.id);
    const b = await parseBody(req, adminQuestionSchema);
    const [q] = await db.update(quizQuestions).set({ quizId: b.quizId, question: b.question, explanation: b.explanation, difficulty: b.difficulty, isArchived: b.isArchived }).where(eq(quizQuestions.id, params.id)).returning();
    if (!q) throw Errors.notFound("Question not found");
    await db.delete(quizOptions).where(eq(quizOptions.questionId, q.id));
    await db.insert(quizOptions).values(b.options.map((o, i) => ({ questionId: q.id, text: o.text, isCorrect: o.isCorrect, position: i })));
    await audit(a.id, "admin.questions.update", { entity: "quiz_question", entityId: q.id, ip });
    return ok((await questionsWithOptions(eq(quizQuestions.id, q.id)))[0]);
  }),
  /** Soft delete (archive) by default; ?hard=true permanently deletes. */
  route("DELETE", "/admin/questions/:id", async ({ params, query, ip }) => {
    const a = await admin();
    uuidSchema.parse(params.id);
    if (query.get("hard") === "true") await db.delete(quizQuestions).where(eq(quizQuestions.id, params.id));
    else await db.update(quizQuestions).set({ isArchived: true }).where(eq(quizQuestions.id, params.id));
    await audit(a.id, "admin.questions.delete", { entity: "quiz_question", entityId: params.id, ip, metadata: { hard: query.get("hard") === "true" } });
    return ok({ deleted: true });
  }),
  /** AI drafts are saved ARCHIVED so an admin reviews them before students see them. */
  route("POST", "/admin/questions/generate", async ({ req, ip }) => {
    const a = await admin();
    const b = await parseBody(req, adminGenerateQuestionsSchema);
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, b.quizId));
    if (!quiz) throw Errors.notFound("Quiz not found");
    const { questions } = await quizGenerationService(b.topic, b.count);
    for (const g of questions) {
      const [q] = await db.insert(quizQuestions).values({ quizId: quiz.id, question: g.question, explanation: g.explanation, difficulty: g.difficulty, isArchived: true }).returning();
      await db.insert(quizOptions).values(g.options.map((t, i) => ({ questionId: q.id, text: t, isCorrect: i === g.correctIndex, position: i })));
    }
    await audit(a.id, "ai.quiz_generation", { entity: "quiz", entityId: quiz.id, ip, metadata: { count: questions.length } });
    return ok({ created: questions.length }, 201);
  }),

  /* ---------------- Simple content ---------------- */
  ...crud("news", news, adminNewsSchema, { orderBy: desc(news.publishedAt) }),
  ...crud("announcements", announcements, adminAnnouncementSchema, {
    orderBy: desc(announcements.publishedAt),
    map: (b, adminId) => ({ ...b, authorId: adminId, expiresAt: b.expiresAt ? new Date(b.expiresAt) : null }),
  }),
  ...crud("placements", placementStats, adminPlacementSchema, { orderBy: desc(placementStats.graduationYear) }),
  ...crud("resources", resources, adminResourceSchema, { orderBy: asc(resources.category), map: (b, adminId) => ({ ...b, createdBy: adminId }) }),
  ...crud("interviews", interviewQuestions, adminInterviewQuestionSchema, { orderBy: desc(interviewQuestions.createdAt) }),
  route("GET", "/admin/interview-categories", async () => {
    await admin();
    return ok(await db.select().from(interviewCategories).orderBy(asc(interviewCategories.name)));
  }),

  /* ---------------- Moderation ---------------- */
  route("GET", "/admin/reports", async () => {
    await admin();
    const rows = await db
      .select({ id: forumReports.id, reason: forumReports.reason, status: forumReports.status, createdAt: forumReports.createdAt, postId: forumPosts.id, postTitle: forumPosts.title, postHidden: forumPosts.isHidden, reporter: users.name })
      .from(forumReports)
      .innerJoin(forumPosts, eq(forumPosts.id, forumReports.postId))
      .innerJoin(users, eq(users.id, forumReports.reporterId))
      .orderBy(asc(forumReports.status), desc(forumReports.createdAt))
      .limit(200);
    return ok(rows);
  }),
  route("PUT", "/admin/reports/:id", async ({ req, params, ip }) => {
    const a = await admin();
    uuidSchema.parse(params.id);
    const body = (await req.json().catch(() => ({}))) as { status?: string };
    if (!body.status || !["open", "resolved", "dismissed"].includes(body.status)) throw Errors.badRequest("status must be open, resolved or dismissed");
    const [r] = await db.update(forumReports).set({ status: body.status as "open" }).where(eq(forumReports.id, params.id)).returning();
    if (!r) throw Errors.notFound();
    await audit(a.id, "admin.report.update", { entity: "forum_report", entityId: r.id, ip, metadata: { status: body.status } });
    return ok(r);
  }),
  route("DELETE", "/admin/forum/posts/:id", async ({ params, ip }) => {
    const a = await admin();
    uuidSchema.parse(params.id);
    const r = await db.delete(forumPosts).where(eq(forumPosts.id, params.id)).returning({ id: forumPosts.id });
    if (!r.length) throw Errors.notFound();
    await audit(a.id, "admin.forum_post_deleted", { entity: "forum_post", entityId: params.id, ip });
    return ok({ deleted: true });
  }),
  route("PUT", "/admin/forum/posts/:id", async ({ req, params, ip }) => {
    const a = await admin();
    uuidSchema.parse(params.id);
    const body = (await req.json().catch(() => ({}))) as { isHidden?: unknown };
    if (typeof body.isHidden !== "boolean") throw Errors.badRequest("isHidden must be a boolean");
    const [p] = await db.update(forumPosts).set({ isHidden: body.isHidden }).where(eq(forumPosts.id, params.id)).returning();
    if (!p) throw Errors.notFound();
    if (body.isHidden) await db.update(forumReports).set({ status: "resolved" }).where(and(eq(forumReports.postId, p.id), eq(forumReports.status, "open")));
    await audit(a.id, body.isHidden ? "admin.post.hide" : "admin.post.unhide", { entity: "forum_post", entityId: p.id, ip });
    return ok(p);
  }),
];

import { and, asc, avg, count, desc, eq, ilike, inArray, max, or } from "drizzle-orm";
import { db } from "@/db";
import {
  quizzes, quizQuestions, quizOptions, quizAttempts, quizAnswers,
  interviewCategories, interviewQuestions, interviewSessions, interviewAnswers,
} from "@/db/schema";
import { route } from "../router";
import { ok, parseBody, rateLimit, audit, Errors } from "../http";
import { requireUser } from "../auth";
import { quizSubmitSchema, interviewStartSchema, interviewAnswerSchema, interviewFeedbackSchema, uuidSchema } from "../schemas";
import { scoreQuiz, shuffle } from "../logic";
import { interviewFeedbackService } from "../ai/services";

async function ownSession(userId: string, id: string) {
  uuidSchema.parse(id);
  const [s] = await db.select().from(interviewSessions).where(and(eq(interviewSessions.id, id), eq(interviewSessions.userId, userId))).limit(1);
  if (!s) throw Errors.notFound("Interview session not found");
  return s;
}

export const practiceRoutes = [
  /* ================= Quizzes ================= */
  route("GET", "/quizzes", async ({ query }) => {
    const u = await requireUser();
    const q = query.get("q")?.trim();
    const category = query.get("category")?.trim();
    const conds = [eq(quizzes.isActive, true)];
    if (q) conds.push(or(ilike(quizzes.title, `%${q}%`), ilike(quizzes.description, `%${q}%`))!);
    if (category) conds.push(eq(quizzes.category, category));
    const rows = await db
      .select({ id: quizzes.id, title: quizzes.title, category: quizzes.category, description: quizzes.description, timeLimitSeconds: quizzes.timeLimitSeconds, questionCount: quizzes.questionCount, bank: count(quizQuestions.id) })
      .from(quizzes)
      .leftJoin(quizQuestions, and(eq(quizQuestions.quizId, quizzes.id), eq(quizQuestions.isArchived, false)))
      .where(and(...conds))
      .groupBy(quizzes.id)
      .orderBy(asc(quizzes.title));
    const mine = await db
      .select({ quizId: quizAttempts.quizId, best: max(quizAttempts.percentage), avg: avg(quizAttempts.percentage), n: count() })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, u.id))
      .groupBy(quizAttempts.quizId);
    return ok(rows.map((r) => {
      const m = mine.find((x) => x.quizId === r.id);
      return { ...r, bank: Number(r.bank), attempts: Number(m?.n ?? 0), best: m?.best ?? null, average: m?.avg ? Math.round(Number(m.avg)) : null };
    }));
  }),

  route("GET", "/quizzes/attempts/me", async () => {
    const u = await requireUser();
    const rows = await db
      .select({ id: quizAttempts.id, quizId: quizAttempts.quizId, title: quizzes.title, category: quizzes.category, score: quizAttempts.score, total: quizAttempts.total, percentage: quizAttempts.percentage, durationSeconds: quizAttempts.durationSeconds, createdAt: quizAttempts.createdAt })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .where(eq(quizAttempts.userId, u.id))
      .orderBy(desc(quizAttempts.createdAt))
      .limit(100);
    return ok(rows);
  }),

  /** Starts a quiz: returns N random active questions with shuffled options — without correct answers. */
  route("GET", "/quizzes/:id", async ({ params }) => {
    await requireUser();
    uuidSchema.parse(params.id);
    const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, params.id), eq(quizzes.isActive, true))).limit(1);
    if (!quiz) throw Errors.notFound("Quiz not found");
    const qs = await db.select({ id: quizQuestions.id, question: quizQuestions.question, difficulty: quizQuestions.difficulty }).from(quizQuestions).where(and(eq(quizQuestions.quizId, quiz.id), eq(quizQuestions.isArchived, false)));
    const picked = shuffle(qs).slice(0, quiz.questionCount);
    const opts = picked.length ? await db.select({ id: quizOptions.id, questionId: quizOptions.questionId, text: quizOptions.text }).from(quizOptions).where(inArray(quizOptions.questionId, picked.map((p) => p.id))) : [];
    return ok({
      quiz,
      questions: picked.map((p) => ({ ...p, options: shuffle(opts.filter((o) => o.questionId === p.id)).map(({ id, text }) => ({ id, text })) })),
    });
  }),

  /** Server-side scoring. Correct answers are revealed only after submission. */
  route("POST", "/quizzes/:id/attempts", async ({ req, params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    rateLimit(`quiz:${u.id}`, 30, 10 * 60_000);
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, params.id)).limit(1);
    if (!quiz) throw Errors.notFound("Quiz not found");
    const body = await parseBody(req, quizSubmitSchema);
    const qIds = [...new Set(body.answers.map((a) => a.questionId))];
    const qs = await db.select().from(quizQuestions).where(and(eq(quizQuestions.quizId, quiz.id), inArray(quizQuestions.id, qIds)));
    if (!qs.length) throw Errors.badRequest("No valid questions submitted for this quiz");
    const opts = await db.select().from(quizOptions).where(inArray(quizOptions.questionId, qs.map((q) => q.id))).orderBy(asc(quizOptions.position));
    const keys = qs.map((q) => ({
      questionId: q.id,
      optionIds: opts.filter((o) => o.questionId === q.id).map((o) => o.id),
      correctOptionId: opts.find((o) => o.questionId === q.id && o.isCorrect)?.id ?? "",
    }));
    const result = scoreQuiz(keys, body.answers);
    const [attempt] = await db
      .insert(quizAttempts)
      .values({ userId: u.id, quizId: quiz.id, score: result.score, total: result.total, percentage: result.percentage, durationSeconds: Math.min(body.durationSeconds, quiz.timeLimitSeconds + 120) })
      .returning();
    await db.insert(quizAnswers).values(result.graded.map((g) => ({ attemptId: attempt.id, questionId: g.questionId, selectedOptionId: g.optionId, isCorrect: g.isCorrect })));
    const review = result.graded.map((g) => {
      const q = qs.find((x) => x.id === g.questionId)!;
      return {
        questionId: q.id,
        question: q.question,
        explanation: q.explanation,
        selectedOptionId: g.optionId,
        isCorrect: g.isCorrect,
        options: opts.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      };
    });
    return ok({ attempt, review }, 201);
  }),

  /* ================= Interviews ================= */
  route("GET", "/interviews/categories", async () => {
    await requireUser();
    const rows = await db
      .select({ id: interviewCategories.id, slug: interviewCategories.slug, name: interviewCategories.name, description: interviewCategories.description, questions: count(interviewQuestions.id) })
      .from(interviewCategories)
      .leftJoin(interviewQuestions, eq(interviewQuestions.categoryId, interviewCategories.id))
      .groupBy(interviewCategories.id)
      .orderBy(asc(interviewCategories.name));
    return ok(rows.map((r) => ({ ...r, questions: Number(r.questions) })));
  }),

  route("GET", "/interviews/questions", async ({ query }) => {
    await requireUser();
    const q = query.get("q")?.trim();
    const cat = query.get("category")?.trim();
    const conds = [];
    if (q) conds.push(ilike(interviewQuestions.question, `%${q}%`));
    if (cat) conds.push(eq(interviewCategories.slug, cat));
    const rows = await db
      .select({ id: interviewQuestions.id, question: interviewQuestions.question, guidance: interviewQuestions.guidance, difficulty: interviewQuestions.difficulty, category: interviewCategories.name, categorySlug: interviewCategories.slug })
      .from(interviewQuestions)
      .innerJoin(interviewCategories, eq(interviewCategories.id, interviewQuestions.categoryId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(interviewCategories.name))
      .limit(200);
    return ok(rows);
  }),

  route("POST", "/interviews/sessions", async ({ req }) => {
    const u = await requireUser();
    const b = await parseBody(req, interviewStartSchema);
    const [cat] = await db.select().from(interviewCategories).where(eq(interviewCategories.slug, b.category)).limit(1);
    if (!cat) throw Errors.notFound("Interview category not found");
    const qs = await db.select().from(interviewQuestions).where(eq(interviewQuestions.categoryId, cat.id));
    if (!qs.length) throw Errors.badRequest("This category has no questions yet");
    const picked = shuffle(qs).slice(0, b.count);
    const [session] = await db.insert(interviewSessions).values({ userId: u.id, categoryId: cat.id, questionIds: picked.map((p) => p.id) }).returning();
    return ok({ session, category: cat, questions: picked.map((p) => ({ id: p.id, question: p.question, difficulty: p.difficulty })) }, 201);
  }),

  route("GET", "/interviews/sessions", async () => {
    const u = await requireUser();
    const rows = await db
      .select({ id: interviewSessions.id, status: interviewSessions.status, createdAt: interviewSessions.createdAt, completedAt: interviewSessions.completedAt, category: interviewCategories.name, questionIds: interviewSessions.questionIds })
      .from(interviewSessions)
      .innerJoin(interviewCategories, eq(interviewCategories.id, interviewSessions.categoryId))
      .where(eq(interviewSessions.userId, u.id))
      .orderBy(desc(interviewSessions.createdAt))
      .limit(50);
    const ids = rows.map((r) => r.id);
    const stats = ids.length
      ? await db.select({ sessionId: interviewAnswers.sessionId, n: count(), avg: avg(interviewAnswers.score) }).from(interviewAnswers).where(inArray(interviewAnswers.sessionId, ids)).groupBy(interviewAnswers.sessionId)
      : [];
    return ok(rows.map((r) => {
      const s = stats.find((x) => x.sessionId === r.id);
      return { ...r, total: r.questionIds.length, answered: Number(s?.n ?? 0), averageScore: s?.avg ? Math.round(Number(s.avg) * 10) / 10 : null };
    }));
  }),

  route("GET", "/interviews/sessions/:id", async ({ params }) => {
    const u = await requireUser();
    const s = await ownSession(u.id, params.id);
    const [cat] = await db.select().from(interviewCategories).where(eq(interviewCategories.id, s.categoryId));
    const qs = s.questionIds.length ? await db.select().from(interviewQuestions).where(inArray(interviewQuestions.id, s.questionIds)) : [];
    const answers = await db.select().from(interviewAnswers).where(eq(interviewAnswers.sessionId, s.id));
    return ok({
      session: s,
      category: cat,
      questions: s.questionIds.map((id) => qs.find((q) => q.id === id)).filter(Boolean).map((q) => ({ id: q!.id, question: q!.question, difficulty: q!.difficulty })),
      answers,
    });
  }),

  route("POST", "/interviews/sessions/:id/answers", async ({ req, params }) => {
    const u = await requireUser();
    const s = await ownSession(u.id, params.id);
    if (s.status === "completed") throw Errors.badRequest("This session is already completed");
    const b = await parseBody(req, interviewAnswerSchema);
    if (!s.questionIds.includes(b.questionId)) throw Errors.badRequest("Question is not part of this session");
    const [a] = await db
      .insert(interviewAnswers)
      .values({ sessionId: s.id, questionId: b.questionId, answerText: b.answer })
      .onConflictDoUpdate({ target: [interviewAnswers.sessionId, interviewAnswers.questionId], set: { answerText: b.answer, feedback: null, score: null } })
      .returning();
    return ok(a, 201);
  }),

  route("POST", "/interviews/sessions/:id/feedback", async ({ req, params, ip }) => {
    const u = await requireUser();
    rateLimit(`ai:${u.id}`, 30, 10 * 60_000);
    const s = await ownSession(u.id, params.id);
    const { answerId } = await parseBody(req, interviewFeedbackSchema);
    const [a] = await db.select().from(interviewAnswers).where(and(eq(interviewAnswers.id, answerId), eq(interviewAnswers.sessionId, s.id))).limit(1);
    if (!a) throw Errors.notFound("Answer not found");
    const [q] = await db.select().from(interviewQuestions).where(eq(interviewQuestions.id, a.questionId));
    const [cat] = await db.select().from(interviewCategories).where(eq(interviewCategories.id, s.categoryId));
    const fb = await interviewFeedbackService(cat?.name ?? "General", q?.question ?? "", q?.guidance ?? "", a.answerText);
    const [updated] = await db.update(interviewAnswers).set({ feedback: fb, score: Math.round(fb.overall) }).where(eq(interviewAnswers.id, a.id)).returning();
    await audit(u.id, "ai.interview_feedback", { entity: "interview_answer", entityId: a.id, ip });
    return ok(updated);
  }),

  route("POST", "/interviews/sessions/:id/complete", async ({ params }) => {
    const u = await requireUser();
    const s = await ownSession(u.id, params.id);
    const [updated] = await db.update(interviewSessions).set({ status: "completed", completedAt: new Date() }).where(eq(interviewSessions.id, s.id)).returning();
    return ok(updated);
  }),
];

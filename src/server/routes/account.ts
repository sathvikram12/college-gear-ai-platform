import { and, avg, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users, profiles, quizAttempts, quizzes, notes, interviewSessions,
  codingSessions, jarvisConversations, scheduleEntries, resumeProfiles, careerProfiles, careerRecommendations,
  announcements, announcementReads, notifications,
} from "@/db/schema";
import { route } from "../router";
import { ok, parseBody, rateLimit, Errors } from "../http";
import { requireUser } from "../auth";
import { profileSchema } from "../schemas";
import { computeStreak, resumeCompletion } from "../logic";
import { aiConfigured } from "../ai/gemini";
import type { ResumeData } from "../schemas";

async function loadProfile(userId: string) {
  const [row] = await db
    .select({ user: { id: users.id, name: users.name, role: users.role, createdAt: users.createdAt }, profile: profiles })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw Errors.notFound("User not found");
  return { ...row.user, profile: row.profile };
}

const AVATAR_MAX = 1024 * 1024;
function sniffImage(buf: Buffer): string | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export const accountRoutes = [
  /** Public capability flags (no secrets) so the UI can explain unavailable features. */
  route("GET", "/system/status", async () => ok({ ai: aiConfigured(), serverCodeExecution: !!process.env.JUDGE0_URL })),

  /* ---------------- Workspace (no login) ---------------- */
  /** Current browser workspace (created automatically — no credentials). */
  route("GET", "/workspace", async () => {
    const u = await requireUser();
    const p = await loadProfile(u.id);
    return ok({ user: { id: p.id, name: p.name, role: p.role, avatar: p.profile?.avatarData ?? null } });
  }),

  /* ---------------- Profile ---------------- */
  route("GET", "/profile", async () => {
    const u = await requireUser();
    return ok(await loadProfile(u.id));
  }),

  route("PUT", "/profile", async ({ req }) => {
    const u = await requireUser();
    const b = await parseBody(req, profileSchema);
    await db.update(users).set({ name: b.name }).where(eq(users.id, u.id));
    const values = { department: b.department, degree: b.degree, year: b.year ?? null, bio: b.bio, skills: b.skills, careerInterests: b.careerInterests };
    await db.insert(profiles).values({ userId: u.id, ...values }).onConflictDoUpdate({ target: profiles.userId, set: values });
    return ok(await loadProfile(u.id));
  }),

  route("POST", "/profile/avatar", async ({ req }) => {
    const u = await requireUser();
    rateLimit(`avatar:${u.id}`, 10, 60 * 60_000);
    const form = await req.formData().catch(() => null);
    const file = form?.get("avatar");
    if (!(file instanceof File)) throw Errors.badRequest("Attach an image file in the 'avatar' field");
    if (file.size > AVATAR_MAX) throw Errors.badRequest("Avatar must be 1 MB or smaller");
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(buf);
    if (!mime) throw Errors.badRequest("Only PNG, JPEG or WEBP images are allowed");
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    await db.insert(profiles).values({ userId: u.id, avatarData: dataUrl }).onConflictDoUpdate({ target: profiles.userId, set: { avatarData: dataUrl } });
    return ok({ avatar: dataUrl });
  }),

  route("DELETE", "/profile/avatar", async () => {
    const u = await requireUser();
    await db.update(profiles).set({ avatarData: null }).where(eq(profiles.userId, u.id));
    return ok({ avatar: null });
  }),

  /* ---------------- Notifications ---------------- */
  route("GET", "/notifications", async () => {
    const u = await requireUser();
    const rows = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(30);
    return ok(rows);
  }),
  route("POST", "/notifications/read-all", async () => {
    const u = await requireUser();
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, u.id), isNull(notifications.readAt)));
    return ok({ done: true });
  }),

  /* ---------------- Student Command Center ---------------- */
  route("GET", "/dashboard", async () => {
    const u = await requireUser();
    const uid = u.id;
    const [
      [quizAgg], [noteCount], [interviewCount], [codingCount], [resume], [career], [latestRec], upcoming, recentQuiz, recentNotes,
      recentConvs, recentInterviews, recentCode, weakCats, [unreadAnn],
    ] = await Promise.all([
      db.select({ avg: avg(quizAttempts.percentage), n: count() }).from(quizAttempts).where(eq(quizAttempts.userId, uid)),
      db.select({ n: count() }).from(notes).where(eq(notes.userId, uid)),
      db.select({ n: count() }).from(interviewSessions).where(eq(interviewSessions.userId, uid)),
      db.select({ n: count() }).from(codingSessions).where(eq(codingSessions.userId, uid)),
      db.select({ data: resumeProfiles.data }).from(resumeProfiles).where(eq(resumeProfiles.userId, uid)),
      db.select().from(careerProfiles).where(eq(careerProfiles.userId, uid)),
      db.select({ result: careerRecommendations.result, createdAt: careerRecommendations.createdAt }).from(careerRecommendations).where(eq(careerRecommendations.userId, uid)).orderBy(desc(careerRecommendations.createdAt)).limit(1),
      db.select().from(scheduleEntries).where(eq(scheduleEntries.userId, uid)),
      db.select({ id: quizAttempts.id, title: quizzes.title, percentage: quizAttempts.percentage, at: quizAttempts.createdAt }).from(quizAttempts).innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId)).where(eq(quizAttempts.userId, uid)).orderBy(desc(quizAttempts.createdAt)).limit(5),
      db.select({ id: notes.id, title: notes.title, at: notes.updatedAt }).from(notes).where(eq(notes.userId, uid)).orderBy(desc(notes.updatedAt)).limit(5),
      db.select({ id: jarvisConversations.id, title: jarvisConversations.title, at: jarvisConversations.updatedAt }).from(jarvisConversations).where(eq(jarvisConversations.userId, uid)).orderBy(desc(jarvisConversations.updatedAt)).limit(5),
      db.select({ id: interviewSessions.id, status: interviewSessions.status, at: interviewSessions.createdAt }).from(interviewSessions).where(eq(interviewSessions.userId, uid)).orderBy(desc(interviewSessions.createdAt)).limit(5),
      db.select({ id: codingSessions.id, title: codingSessions.title, language: codingSessions.language, at: codingSessions.updatedAt }).from(codingSessions).where(eq(codingSessions.userId, uid)).orderBy(desc(codingSessions.updatedAt)).limit(5),
      db.select({ category: quizzes.category, title: quizzes.title, avg: avg(quizAttempts.percentage) }).from(quizAttempts).innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId)).where(eq(quizAttempts.userId, uid)).groupBy(quizzes.category, quizzes.title).orderBy(avg(quizAttempts.percentage)).limit(2),
      db.select({ n: count() }).from(announcements).leftJoin(announcementReads, and(eq(announcementReads.announcementId, announcements.id), eq(announcementReads.userId, uid))).where(isNull(announcementReads.userId)),
    ]);

    const dayRows = await db.execute<{ d: string }>(sql`
      select distinct to_char(d at time zone 'UTC', 'YYYY-MM-DD') as d from (
        select created_at as d from quiz_attempts where user_id = ${uid}
        union all select updated_at from notes where user_id = ${uid}
        union all select m.created_at from jarvis_messages m join jarvis_conversations c on c.id = m.conversation_id where c.user_id = ${uid}
        union all select a.created_at from interview_answers a join interview_sessions s on s.id = a.session_id where s.user_id = ${uid}
        union all select updated_at from coding_sessions where user_id = ${uid}
      ) t where d > now() - interval '90 days'`);
    const streak = computeStreak(dayRows.rows.map((r) => r.d));

    // Upcoming: order by next occurrence from now (day 0 = Monday).
    const now = new Date();
    const today = (now.getDay() + 6) % 7;
    const hhmm = now.toTimeString().slice(0, 5);
    const upcomingSorted = upcoming
      .map((e) => {
        let delta = (e.day - today + 7) % 7;
        if (delta === 0 && e.endTime < hhmm) delta = 7;
        return { ...e, delta };
      })
      .sort((a, b) => a.delta - b.delta || a.startTime.localeCompare(b.startTime))
      .slice(0, 5);

    const activity = [
      ...recentQuiz.map((r) => ({ type: "quiz", title: `${r.title} — ${Math.round(r.percentage)}%`, href: "/quizzes", at: r.at })),
      ...recentNotes.map((r) => ({ type: "note", title: r.title, href: "/notes", at: r.at })),
      ...recentConvs.map((r) => ({ type: "jarvis", title: r.title, href: `/jarvis?c=${r.id}`, at: r.at })),
      ...recentInterviews.map((r) => ({ type: "interview", title: `Interview session (${r.status})`, href: "/interview", at: r.at })),
      ...recentCode.map((r) => ({ type: "coding", title: `${r.title} · ${r.language}`, href: "/coding", at: r.at })),
    ]
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, 8);

    const [prof] = await db.select().from(profiles).where(eq(profiles.userId, uid));
    const interests = career?.interests?.length ? career.interests : prof?.careerInterests ?? [];
    const suggestions: { label: string; href: string; reason: string }[] = [];
    for (const w of weakCats) if (Number(w.avg) < 70) suggestions.push({ label: `Retake ${w.title}`, href: `/quizzes/${w.category}`, reason: `Your average is ${Math.round(Number(w.avg))}% — a retake will reinforce weak areas.` });
    if (!quizAgg?.n) suggestions.push({ label: "Take your first quiz", href: "/quizzes", reason: "Establish a baseline across subjects." });
    if (!interviewCount?.n) suggestions.push({ label: "Practice a mock interview", href: "/interview", reason: "Get AI coaching on structure and clarity." });
    if (resumeCompletion(resume?.data as ResumeData) < 60) suggestions.push({ label: "Complete your resume", href: "/resume", reason: "A complete resume unlocks better cover letters and keyword matching." });
    if (!career) suggestions.push({ label: "Set up your career profile", href: "/career", reason: "Personalises recommendations across COLLEGE GEAR." });
    if (!upcoming.length) suggestions.push({ label: "Add your timetable", href: "/schedule", reason: "See upcoming classes on your dashboard." });

    return ok({
      name: u.name,
      stats: {
        quizAverage: quizAgg?.avg ? Math.round(Number(quizAgg.avg)) : null,
        quizzesCompleted: Number(quizAgg?.n ?? 0),
        interviewSessions: Number(interviewCount?.n ?? 0),
        notes: Number(noteCount?.n ?? 0),
        codingSessions: Number(codingCount?.n ?? 0),
        resumeCompletion: resumeCompletion(resume?.data as ResumeData),
        streak,
        unreadAnnouncements: Number(unreadAnn?.n ?? 0),
      },
      upcoming: upcomingSorted,
      activity,
      career: { interests, goals: career?.careerGoals ?? "", latest: latestRec ?? null },
      suggestions: suggestions.slice(0, 4),
    });
  }),
];

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { careerProfiles, careerRecommendations, resumeProfiles, resumeVersions, coverLetters, profiles } from "@/db/schema";
import { route } from "../router";
import { ok, parseBody, rateLimit, audit, Errors } from "../http";
import { requireUser } from "../auth";
import { careerProfileSchema, resumeSaveSchema, resumeAiSchema, coverLetterGenSchema, coverLetterUpdateSchema, resumeDataSchema, uuidSchema, type ResumeData } from "../schemas";
import { careerRecommendationService, resumeService, coverLetterService } from "../ai/services";

async function getResume(userId: string) {
  const [r] = await db.select().from(resumeProfiles).where(eq(resumeProfiles.userId, userId)).limit(1);
  return r ?? null;
}

async function saveResume(userId: string, body: unknown) {
  const b = resumeSaveSchema.parse(body);
  const [r] = await db
    .insert(resumeProfiles)
    .values({ userId, template: b.template, data: b.data })
    .onConflictDoUpdate({ target: resumeProfiles.userId, set: { template: b.template, data: b.data, updatedAt: new Date() } })
    .returning();
  if (b.snapshotLabel) await db.insert(resumeVersions).values({ resumeId: r.id, userId, label: b.snapshotLabel, data: b.data });
  return r;
}

const joinSections = (s: { opening: string; skills: string; experience: string; closing: string }) => [s.opening, s.skills, s.experience, s.closing].filter(Boolean).join("\n\n");

export const careerRoutes = [
  /* ================= Career ================= */
  route("GET", "/career/profile", async () => {
    const u = await requireUser();
    const [c] = await db.select().from(careerProfiles).where(eq(careerProfiles.userId, u.id));
    const history = await db.select().from(careerRecommendations).where(eq(careerRecommendations.userId, u.id)).orderBy(desc(careerRecommendations.createdAt)).limit(10);
    if (c) return ok({ profile: c, history });
    const [p] = await db.select().from(profiles).where(eq(profiles.userId, u.id));
    return ok({
      profile: p ? { degree: p.degree ?? "", department: p.department ?? "", year: p.year, interests: p.careerInterests, skills: p.skills, preferredIndustries: [], careerGoals: "" } : null,
      history,
    });
  }),
  route("PUT", "/career/profile", async ({ req }) => {
    const u = await requireUser();
    const b = await parseBody(req, careerProfileSchema);
    const [c] = await db.insert(careerProfiles).values({ userId: u.id, ...b }).onConflictDoUpdate({ target: careerProfiles.userId, set: b }).returning();
    return ok(c);
  }),
  route("POST", "/career/recommendations", async ({ ip }) => {
    const u = await requireUser();
    rateLimit(`ai:${u.id}`, 30, 10 * 60_000);
    const [c] = await db.select().from(careerProfiles).where(eq(careerProfiles.userId, u.id));
    if (!c) throw Errors.badRequest("Save your career profile first");
    const input = { degree: c.degree, department: c.department, year: c.year, interests: c.interests, skills: c.skills, preferredIndustries: c.preferredIndustries, careerGoals: c.careerGoals };
    const result = await careerRecommendationService(input);
    const [rec] = await db.insert(careerRecommendations).values({ userId: u.id, input, result }).returning();
    await audit(u.id, "ai.career_recommendation", { entity: "career_recommendation", entityId: rec.id, ip });
    return ok(rec, 201);
  }),
  route("DELETE", "/career/recommendations/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    await db.delete(careerRecommendations).where(and(eq(careerRecommendations.id, params.id), eq(careerRecommendations.userId, u.id)));
    return ok({ deleted: true });
  }),

  /* ================= Resume ================= */
  route("GET", "/resume", async () => {
    const u = await requireUser();
    const r = await getResume(u.id);
    const versions = await db
      .select({ id: resumeVersions.id, label: resumeVersions.label, createdAt: resumeVersions.createdAt })
      .from(resumeVersions)
      .where(eq(resumeVersions.userId, u.id))
      .orderBy(desc(resumeVersions.createdAt))
      .limit(20);
    return ok({ resume: r, versions });
  }),
  route("POST", "/resume", async ({ req }) => ok(await saveResume((await requireUser()).id, await req.json().catch(() => null)), 201)),
  route("PUT", "/resume", async ({ req }) => ok(await saveResume((await requireUser()).id, await req.json().catch(() => null)))),
  route("GET", "/resume/versions/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const [v] = await db.select().from(resumeVersions).where(and(eq(resumeVersions.id, params.id), eq(resumeVersions.userId, u.id)));
    if (!v) throw Errors.notFound("Version not found");
    return ok(v);
  }),
  route("POST", "/resume/ai-improve", async ({ req, ip }) => {
    const u = await requireUser();
    rateLimit(`ai:${u.id}`, 30, 10 * 60_000);
    const b = await parseBody(req, resumeAiSchema);
    const r = await getResume(u.id);
    if (!r) throw Errors.badRequest("Save your resume first so AI can work with your real information");
    const data = resumeDataSchema.parse(r.data);
    if (b.action === "keywords" && b.jobDescription.trim().length < 30) throw Errors.badRequest("Paste a job description (at least 30 characters)");
    if ((b.action === "bullets" || b.action === "project") && b.target.trim().length < 10) throw Errors.badRequest("Provide the text you want to improve");
    const result = await resumeService(b.action, data, b.target, b.jobDescription);
    await audit(u.id, `ai.resume_${b.action}`, { ip });
    return ok(result);
  }),

  /* ================= Cover letters ================= */
  route("POST", "/cover-letter/generate", async ({ req, ip }) => {
    const u = await requireUser();
    rateLimit(`ai:${u.id}`, 30, 10 * 60_000);
    const b = await parseBody(req, coverLetterGenSchema);
    const r = await getResume(u.id);
    const data = r ? (resumeDataSchema.safeParse(r.data).data ?? null) : null;
    const sections = await coverLetterService(data as ResumeData | null, u.name, b.jobTitle, b.company, b.jobDescription);
    const [cl] = await db
      .insert(coverLetters)
      .values({ userId: u.id, jobTitle: b.jobTitle, company: b.company, jobDescription: b.jobDescription, sections, finalText: joinSections(sections) })
      .returning();
    await audit(u.id, "ai.cover_letter", { entity: "cover_letter", entityId: cl.id, ip });
    return ok({ ...cl, usedResume: !!data }, 201);
  }),
  route("GET", "/cover-letter", async () => {
    const u = await requireUser();
    return ok(await db.select().from(coverLetters).where(eq(coverLetters.userId, u.id)).orderBy(desc(coverLetters.createdAt)));
  }),
  route("GET", "/cover-letter/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const [cl] = await db.select().from(coverLetters).where(and(eq(coverLetters.id, params.id), eq(coverLetters.userId, u.id)));
    if (!cl) throw Errors.notFound("Cover letter not found");
    return ok(cl);
  }),
  route("PUT", "/cover-letter/:id", async ({ req, params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const b = await parseBody(req, coverLetterUpdateSchema);
    const [cl] = await db.update(coverLetters).set({ finalText: b.finalText }).where(and(eq(coverLetters.id, params.id), eq(coverLetters.userId, u.id))).returning();
    if (!cl) throw Errors.notFound("Cover letter not found");
    return ok(cl);
  }),
  route("DELETE", "/cover-letter/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    await db.delete(coverLetters).where(and(eq(coverLetters.id, params.id), eq(coverLetters.userId, u.id)));
    return ok({ deleted: true });
  }),
];

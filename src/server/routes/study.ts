import { and, asc, desc, eq, ilike, inArray, or, sql, exists } from "drizzle-orm";
import { db } from "@/db";
import { notes, noteTags, jarvisConversations, jarvisMessages, profiles, careerProfiles } from "@/db/schema";
import { route } from "../router";
import { ok, parseBody, rateLimit, audit, Errors } from "../http";
import { requireUser } from "../auth";
import { noteSchema, noteAiSchema, jarvisChatSchema, jarvisMessageSchema, uuidSchema } from "../schemas";
import { jarvisService, noteSummaryService } from "../ai/services";

/* ---------------- Notes helpers ---------------- */
async function withTags<T extends { id: string }>(rows: T[]) {
  if (!rows.length) return [] as (T & { tags: string[] })[];
  const tags = await db.select().from(noteTags).where(inArray(noteTags.noteId, rows.map((r) => r.id)));
  return rows.map((r) => ({ ...r, tags: tags.filter((t) => t.noteId === r.id).map((t) => t.tag) }));
}
async function ownNote(userId: string, id: string) {
  uuidSchema.parse(id);
  const [n] = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).limit(1);
  if (!n) throw Errors.notFound("Note not found");
  return n;
}
async function setTags(userId: string, noteId: string, tags: string[]) {
  await db.delete(noteTags).where(eq(noteTags.noteId, noteId));
  const uniq = [...new Set(tags)];
  if (uniq.length) await db.insert(noteTags).values(uniq.map((tag) => ({ noteId, userId, tag })));
}

/* ---------------- Jarvis helpers ---------------- */
async function ownConversation(userId: string, id: string) {
  uuidSchema.parse(id);
  const [c] = await db.select().from(jarvisConversations).where(and(eq(jarvisConversations.id, id), eq(jarvisConversations.userId, userId))).limit(1);
  if (!c) throw Errors.notFound("Conversation not found");
  return c;
}

async function askJarvis(user: { id: string; name: string }, conversationId: string | undefined, message: string, ip: string) {
  rateLimit(`ai:${user.id}`, 30, 10 * 60_000);
  let conv = conversationId ? await ownConversation(user.id, conversationId) : null;
  const history = conv
    ? (await db.select().from(jarvisMessages).where(eq(jarvisMessages.conversationId, conv.id)).orderBy(desc(jarvisMessages.createdAt)).limit(10)).reverse()
    : [];
  const [prof] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
  const [career] = await db.select().from(careerProfiles).where(eq(careerProfiles.userId, user.id));

  const result = await jarvisService({
    message,
    history: history.map((h) => ({ role: h.role, content: h.content })),
    student: {
      name: user.name,
      department: career?.department || prof?.department,
      degree: career?.degree || prof?.degree,
      year: career?.year ?? prof?.year,
      interests: career?.interests?.length ? career.interests : prof?.careerInterests,
    },
  });

  // Persist only after a validated AI response so retries never duplicate messages.
  if (!conv) {
    [conv] = await db.insert(jarvisConversations).values({ userId: user.id, title: message.slice(0, 80) }).returning();
  }
  const [userMsg] = await db.insert(jarvisMessages).values({ conversationId: conv.id, role: "user", content: message }).returning();
  const [aiMsg] = await db
    .insert(jarvisMessages)
    .values({ conversationId: conv.id, role: "assistant", content: result.answer, structured: result, createdAt: new Date(Date.now() + 5) })
    .returning();
  await db.update(jarvisConversations).set({ updatedAt: new Date() }).where(eq(jarvisConversations.id, conv.id));
  await audit(user.id, "ai.jarvis", { entity: "jarvis_conversation", entityId: conv.id, ip });
  return { conversation: conv, messages: [userMsg, aiMsg] };
}

export const studyRoutes = [
  /* ================= Notes ================= */
  route("GET", "/notes", async ({ query }) => {
    const u = await requireUser();
    const q = query.get("q")?.trim();
    const tag = query.get("tag")?.trim().toLowerCase();
    const archived = query.get("archived") === "true";
    const sort = query.get("sort") ?? "updated";
    const conds = [eq(notes.userId, u.id), eq(notes.archived, archived)];
    if (q) conds.push(or(ilike(notes.title, `%${q}%`), ilike(notes.content, `%${q}%`))!);
    if (tag) conds.push(exists(db.select({ x: sql`1` }).from(noteTags).where(and(eq(noteTags.noteId, notes.id), eq(noteTags.tag, tag)))));
    const order = sort === "title" ? asc(notes.title) : sort === "created" ? desc(notes.createdAt) : desc(notes.updatedAt);
    const rows = await db.select().from(notes).where(and(...conds)).orderBy(desc(notes.pinned), order).limit(200);
    const allTags = await db.selectDistinct({ tag: noteTags.tag }).from(noteTags).where(eq(noteTags.userId, u.id)).orderBy(asc(noteTags.tag));
    return ok({ notes: await withTags(rows), tags: allTags.map((t) => t.tag) });
  }),
  route("POST", "/notes", async ({ req }) => {
    const u = await requireUser();
    const b = await parseBody(req, noteSchema);
    const [n] = await db.insert(notes).values({ userId: u.id, title: b.title, content: b.content, pinned: b.pinned, archived: b.archived }).returning();
    await setTags(u.id, n.id, b.tags);
    return ok((await withTags([n]))[0], 201);
  }),
  route("GET", "/notes/:id", async ({ params }) => {
    const u = await requireUser();
    return ok((await withTags([await ownNote(u.id, params.id)]))[0]);
  }),
  route("PUT", "/notes/:id", async ({ req, params }) => {
    const u = await requireUser();
    await ownNote(u.id, params.id);
    const b = await parseBody(req, noteSchema);
    const [n] = await db
      .update(notes)
      .set({ title: b.title, content: b.content, pinned: b.pinned, archived: b.archived })
      .where(and(eq(notes.id, params.id), eq(notes.userId, u.id)))
      .returning();
    await setTags(u.id, n.id, b.tags);
    return ok((await withTags([n]))[0]);
  }),
  route("DELETE", "/notes/:id", async ({ params }) => {
    const u = await requireUser();
    await ownNote(u.id, params.id);
    await db.delete(notes).where(and(eq(notes.id, params.id), eq(notes.userId, u.id)));
    return ok({ deleted: true });
  }),
  route("POST", "/notes/:id/ai", async ({ req, params, ip }) => {
    const u = await requireUser();
    rateLimit(`ai:${u.id}`, 30, 10 * 60_000);
    const n = await ownNote(u.id, params.id);
    const { action } = await parseBody(req, noteAiSchema);
    if (n.content.trim().length < 20) throw Errors.badRequest("Add more content to this note before using AI actions");
    const result = await noteSummaryService(action, n.title, n.content);
    await audit(u.id, `ai.note_${action}`, { entity: "note", entityId: n.id, ip });
    return ok(result);
  }),

  /* ================= Jarvis ================= */
  route("GET", "/jarvis/conversations", async ({ query }) => {
    const u = await requireUser();
    const q = query.get("q")?.trim();
    const conds = [eq(jarvisConversations.userId, u.id)];
    if (q)
      conds.push(
        or(
          ilike(jarvisConversations.title, `%${q}%`),
          exists(db.select({ x: sql`1` }).from(jarvisMessages).where(and(eq(jarvisMessages.conversationId, jarvisConversations.id), ilike(jarvisMessages.content, `%${q}%`))))
        )!
      );
    const rows = await db.select().from(jarvisConversations).where(and(...conds)).orderBy(desc(jarvisConversations.updatedAt)).limit(100);
    return ok(rows);
  }),
  route("POST", "/jarvis/conversations", async ({ req }) => {
    const u = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { title?: unknown };
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : "New conversation";
    const [c] = await db.insert(jarvisConversations).values({ userId: u.id, title }).returning();
    return ok(c, 201);
  }),
  route("GET", "/jarvis/conversations/:id", async ({ params }) => {
    const u = await requireUser();
    const c = await ownConversation(u.id, params.id);
    const messages = await db.select().from(jarvisMessages).where(eq(jarvisMessages.conversationId, c.id)).orderBy(asc(jarvisMessages.createdAt));
    return ok({ conversation: c, messages });
  }),
  route("DELETE", "/jarvis/conversations/:id", async ({ params }) => {
    const u = await requireUser();
    await ownConversation(u.id, params.id);
    await db.delete(jarvisConversations).where(and(eq(jarvisConversations.id, params.id), eq(jarvisConversations.userId, u.id)));
    return ok({ deleted: true });
  }),
  route("DELETE", "/jarvis/conversations/:id/messages", async ({ params }) => {
    const u = await requireUser();
    const c = await ownConversation(u.id, params.id);
    await db.delete(jarvisMessages).where(eq(jarvisMessages.conversationId, c.id));
    return ok({ cleared: true });
  }),
  route("POST", "/jarvis/conversations/:id/messages", async ({ req, params, ip }) => {
    const u = await requireUser();
    const { message } = await parseBody(req, jarvisMessageSchema);
    return ok(await askJarvis(u, params.id, message, ip), 201);
  }),
  route("POST", "/jarvis/chat", async ({ req, ip }) => {
    const u = await requireUser();
    const { conversationId, message } = await parseBody(req, jarvisChatSchema);
    return ok(await askJarvis(u, conversationId, message, ip), 201);
  }),
];

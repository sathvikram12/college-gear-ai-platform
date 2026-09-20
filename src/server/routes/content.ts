import { and, asc, count, desc, eq, gt, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { placementStats, news, announcements, announcementReads, resources, forumCategories, forumPosts, forumComments, forumReports, users } from "@/db/schema";
import { route } from "../router";
import { ok, parseBody, rateLimit, audit, Errors } from "../http";
import { requireUser, hasRole } from "../auth";
import { forumPostSchema, forumCommentSchema, forumReportSchema, uuidSchema } from "../schemas";

let hnCache: { at: number; items: unknown[] } | null = null;

export const contentRoutes = [
  /* ================= Placements ================= */
  route("GET", "/placements", async ({ query }) => {
    await requireUser();
    const dept = query.get("department");
    const rows = await db.select().from(placementStats).where(dept ? eq(placementStats.department, dept) : undefined).orderBy(asc(placementStats.graduationYear), asc(placementStats.department));
    return ok(rows);
  }),

  /* ================= News ================= */
  route("GET", "/news", async ({ query }) => {
    await requireUser();
    const q = query.get("q")?.trim();
    const category = query.get("category")?.trim();
    const conds = [];
    if (q) conds.push(or(ilike(news.title, `%${q}%`), ilike(news.summary, `%${q}%`))!);
    if (category) conds.push(eq(news.category, category));
    return ok(await db.select().from(news).where(conds.length ? and(...conds) : undefined).orderBy(desc(news.publishedAt)).limit(100));
  }),
  /** Live technology headlines from the public Hacker News API (no key required), cached 10 minutes. */
  route("GET", "/news/live", async () => {
    await requireUser();
    if (hnCache && Date.now() - hnCache.at < 10 * 60_000) return ok({ source: "Hacker News", items: hnCache.items });
    try {
      const ids = (await (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { signal: AbortSignal.timeout(6000) })).json()) as number[];
      const items = (
        await Promise.all(
          ids.slice(0, 15).map(async (id) => {
            const it = (await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(6000) })).json()) as { id: number; title?: string; url?: string; score?: number; time?: number; by?: string };
            return it?.title ? { id: it.id, title: it.title, url: it.url ?? `https://news.ycombinator.com/item?id=${it.id}`, score: it.score ?? 0, time: it.time ?? 0, by: it.by ?? "" } : null;
          })
        )
      ).filter(Boolean);
      hnCache = { at: Date.now(), items };
      return ok({ source: "Hacker News", items });
    } catch {
      return ok({ source: "Hacker News", items: [], unavailable: true });
    }
  }),

  /* ================= Announcements ================= */
  route("GET", "/announcements", async ({ query }) => {
    const u = await requireUser();
    const q = query.get("q")?.trim();
    const category = query.get("category")?.trim();
    const priority = query.get("priority")?.trim();
    const conds = [or(isNull(announcements.expiresAt), gt(announcements.expiresAt, new Date()))!];
    if (q) conds.push(or(ilike(announcements.title, `%${q}%`), ilike(announcements.content, `%${q}%`))!);
    if (category) conds.push(eq(announcements.category, category));
    if (priority && ["low", "normal", "high", "urgent"].includes(priority)) conds.push(eq(announcements.priority, priority as "low"));
    const rows = await db
      .select({ a: announcements, readAt: announcementReads.readAt })
      .from(announcements)
      .leftJoin(announcementReads, and(eq(announcementReads.announcementId, announcements.id), eq(announcementReads.userId, u.id)))
      .where(and(...conds))
      .orderBy(desc(announcements.publishedAt))
      .limit(100);
    return ok(rows.map((r) => ({ ...r.a, read: !!r.readAt })));
  }),
  route("POST", "/announcements/:id/read", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    await db.insert(announcementReads).values({ userId: u.id, announcementId: params.id }).onConflictDoNothing();
    return ok({ read: true });
  }),

  /* ================= Resources ================= */
  route("GET", "/resources", async ({ query }) => {
    await requireUser();
    const q = query.get("q")?.trim();
    const category = query.get("category")?.trim();
    const conds = [];
    if (q) conds.push(or(ilike(resources.title, `%${q}%`), ilike(resources.description, `%${q}%`))!);
    if (category) conds.push(eq(resources.category, category));
    return ok(await db.select().from(resources).where(conds.length ? and(...conds) : undefined).orderBy(asc(resources.category), asc(resources.title)));
  }),

  /* ================= Community ================= */
  route("GET", "/forum/categories", async () => {
    await requireUser();
    return ok(await db.select().from(forumCategories).orderBy(asc(forumCategories.name)));
  }),
  route("GET", "/forum/posts", async ({ query }) => {
    const u = await requireUser();
    const q = query.get("q")?.trim();
    const category = query.get("category")?.trim();
    const isAdmin = hasRole(u, "admin");
    const conds = [];
    if (!isAdmin) conds.push(or(eq(forumPosts.isHidden, false), eq(forumPosts.userId, u.id))!);
    if (q) conds.push(or(ilike(forumPosts.title, `%${q}%`), ilike(forumPosts.content, `%${q}%`))!);
    if (category) conds.push(eq(forumCategories.slug, category));
    const rows = await db
      .select({
        id: forumPosts.id, title: forumPosts.title, content: forumPosts.content, isHidden: forumPosts.isHidden, createdAt: forumPosts.createdAt,
        userId: forumPosts.userId, author: users.name, category: forumCategories.name, categorySlug: forumCategories.slug,
        comments: sql<number>`(select count(*)::int from forum_comments c where c.post_id = ${forumPosts.id} and c.is_hidden = false)`,
      })
      .from(forumPosts)
      .innerJoin(users, eq(users.id, forumPosts.userId))
      .innerJoin(forumCategories, eq(forumCategories.id, forumPosts.categoryId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(forumPosts.createdAt))
      .limit(100);
    return ok(rows.map(({ userId, ...r }) => ({ ...r, content: r.content.slice(0, 300), isMine: userId === u.id })));
  }),
  route("POST", "/forum/posts", async ({ req }) => {
    const u = await requireUser();
    rateLimit(`post:${u.id}`, 10, 10 * 60_000);
    const b = await parseBody(req, forumPostSchema);
    const [p] = await db.insert(forumPosts).values({ ...b, userId: u.id }).returning();
    return ok(p, 201);
  }),
  route("GET", "/forum/posts/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const [p] = await db
      .select({ post: forumPosts, author: users.name, category: forumCategories.name })
      .from(forumPosts)
      .innerJoin(users, eq(users.id, forumPosts.userId))
      .innerJoin(forumCategories, eq(forumCategories.id, forumPosts.categoryId))
      .where(eq(forumPosts.id, params.id));
    if (!p || (p.post.isHidden && p.post.userId !== u.id && !hasRole(u, "admin"))) throw Errors.notFound("Post not found");
    const comments = await db
      .select({ id: forumComments.id, content: forumComments.content, createdAt: forumComments.createdAt, author: users.name, userId: forumComments.userId, isHidden: forumComments.isHidden })
      .from(forumComments)
      .innerJoin(users, eq(users.id, forumComments.userId))
      .where(and(eq(forumComments.postId, params.id), hasRole(u, "admin") ? undefined : eq(forumComments.isHidden, false)))
      .orderBy(asc(forumComments.createdAt));
    const { userId, ...post } = p.post;
    return ok({
      post: { ...post, author: p.author, category: p.category, isMine: userId === u.id },
      comments: comments.map(({ userId: cu, ...c }) => ({ ...c, isMine: cu === u.id })),
    });
  }),
  route("POST", "/forum/posts/:id/comments", async ({ req, params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    rateLimit(`comment:${u.id}`, 30, 10 * 60_000);
    const b = await parseBody(req, forumCommentSchema);
    const [p] = await db.select({ id: forumPosts.id, isHidden: forumPosts.isHidden }).from(forumPosts).where(eq(forumPosts.id, params.id));
    if (!p || p.isHidden) throw Errors.notFound("Post not found");
    const [c] = await db.insert(forumComments).values({ postId: p.id, userId: u.id, content: b.content }).returning();
    return ok({ ...c, author: u.name, isMine: true }, 201);
  }),
  route("DELETE", "/forum/posts/:id", async ({ params, ip }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const [p] = await db.select().from(forumPosts).where(eq(forumPosts.id, params.id));
    if (!p) throw Errors.notFound("Post not found");
    if (p.userId !== u.id && !hasRole(u, "admin")) throw Errors.forbidden("You can only delete your own posts");
    await db.delete(forumPosts).where(eq(forumPosts.id, p.id));
    if (p.userId !== u.id) await audit(u.id, "admin.forum_post_deleted", { entity: "forum_post", entityId: p.id, ip });
    return ok({ deleted: true });
  }),
  route("DELETE", "/forum/comments/:id", async ({ params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    const [c] = await db.select().from(forumComments).where(eq(forumComments.id, params.id));
    if (!c) throw Errors.notFound("Comment not found");
    if (c.userId !== u.id && !hasRole(u, "admin")) throw Errors.forbidden("You can only delete your own comments");
    await db.delete(forumComments).where(eq(forumComments.id, c.id));
    return ok({ deleted: true });
  }),
  route("POST", "/forum/posts/:id/report", async ({ req, params }) => {
    const u = await requireUser();
    uuidSchema.parse(params.id);
    rateLimit(`report:${u.id}`, 10, 60 * 60_000);
    const b = await parseBody(req, forumReportSchema);
    await db.insert(forumReports).values({ postId: params.id, reporterId: u.id, reason: b.reason }).onConflictDoNothing();
    const [{ n }] = await db.select({ n: count() }).from(forumReports).where(and(eq(forumReports.postId, params.id), eq(forumReports.status, "open")));
    return ok({ reported: true, openReports: Number(n) }, 201);
  }),
];

/**
 * Optional account endpoints. The website works without an account; these let a visitor
 * sign up / log in so their data is tied to an account instead of one browser.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { refreshTokens, users } from "@/db/schema";
import { route } from "../router";
import { ok, parseBody, rateLimit, audit, Errors, ApiError } from "../http";
import { requireWorkspace, getAccount, requireAccount, startSession, endSession, hashPassword, verifyPassword, toAccount } from "../auth";
import { registerSchema, loginSchema } from "../schemas";

/** Emails are stored lower-cased; compare case-insensitively so legacy rows also match. */
const emailMatch = (email: string) => sql`lower(${users.email}) = ${email.trim().toLowerCase()}`;
const pgCode = (e: unknown) => (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;

export const authRoutes = [
  /** Sign up → account created → signed in immediately (no second login). */
  route("POST", "/auth/register", async ({ req, ip }) => {
    rateLimit(`register:${ip}`, 10, 15 * 60_000);
    const b = await parseBody(req, registerSchema);
    if (await getAccount()) throw Errors.badRequest("You are already logged in. Log out before creating another account.");
    const [exists] = await db.select({ id: users.id }).from(users).where(emailMatch(b.email)).limit(1);
    if (exists) throw Errors.conflict("An account with this email already exists. Please log in instead.");

    const passwordHash = await hashPassword(b.password); // hashed exactly once
    // The visitor's current anonymous workspace becomes the account, so anything already saved is kept.
    const ws = await requireWorkspace();
    let account: typeof users.$inferSelect;
    try {
      account = await db.transaction(async (tx) => {
        const [u] = await tx
          .update(users)
          .set({ email: b.email, name: b.name, passwordHash, isGuest: false, lastLoginAt: new Date() })
          .where(and(eq(users.id, ws.id), eq(users.isGuest, true)))
          .returning();
        if (!u) throw new ApiError(409, "CONFLICT", "Could not create the account. Please try again.");
        // Detach the anonymous workspace key: after logout this browser gets a fresh, empty workspace.
        await tx.delete(refreshTokens).where(eq(refreshTokens.userId, u.id));
        return u;
      });
    } catch (e) {
      if (pgCode(e) === "23505") throw Errors.conflict("An account with this email already exists. Please log in instead.");
      throw e;
    }
    await startSession(account.id);
    await audit(account.id, "auth.register", { entity: "user", entityId: account.id, ip });
    return ok({ user: toAccount(account) }, 201);
  }),

  route("POST", "/auth/login", async ({ req, ip }) => {
    const b = await parseBody(req, loginSchema);
    rateLimit(`login:${ip}:${b.email}`, 10, 15 * 60_000);
    const [u] = await db.select().from(users).where(and(emailMatch(b.email), eq(users.isGuest, false))).limit(1);
    if (!u) {
      await audit(null, "auth.login_failed", { ip, metadata: { reason: "no_account" } });
      throw new ApiError(401, "ACCOUNT_NOT_FOUND", "No account found with this email. Check the spelling or sign up.");
    }
    if (!(await verifyPassword(b.password, u.passwordHash))) {
      await audit(u.id, "auth.login_failed", { ip, metadata: { reason: "wrong_password" } });
      throw new ApiError(401, "INVALID_PASSWORD", "Incorrect password. Please try again.");
    }
    if (!u.isActive) throw new ApiError(403, "ACCOUNT_DISABLED", "This account has been disabled.");
    await endSession(); // replace any previous session in this browser
    await startSession(u.id);
    const [fresh] = await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id)).returning();
    await audit(u.id, "auth.login", { ip });
    return ok({ user: toAccount(fresh ?? u) });
  }),

  /** Ends the session only; the account and all saved data are kept. */
  route("POST", "/auth/logout", async ({ ip }) => {
    const a = await getAccount();
    await endSession();
    if (a) await audit(a.id, "auth.logout", { ip });
    return ok({ loggedOut: true });
  }),

  /** Public: tells the UI whether the visitor is signed in (never 401, so public pages stay error-free). */
  route("GET", "/auth/session", async () => {
    const a = await getAccount();
    return ok({ authenticated: !!a, user: a });
  }),

  /** Protected: the signed-in account (401 for public visitors). */
  route("GET", "/auth/me", async () => ok({ user: await requireAccount() })),
];

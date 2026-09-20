/**
 * Anonymous workspace identity (NO login, sign-up or passwords).
 *
 * Every browser automatically gets its own private workspace via a long-lived random
 * httpOnly cookie. Only a SHA-256 hash of the cookie value is stored (reusing the
 * existing `refresh_tokens` table), so it survives server restarts. Feature routes call
 * `requireUser()` to resolve the current workspace owner — this keeps each visitor's
 * notes, resume, chats, etc. private to their browser without any authentication UI.
 *
 * OPTIONAL ACCOUNTS: a visitor may also sign up / log in. A signed-in account is identified by
 * a signed JWT in the httpOnly `cg_auth` cookie (secret: JWT_SECRET env var) that references a
 * server-side session row, so logout can revoke it. When a valid session exists, `requireUser()`
 * returns the account instead of the anonymous workspace — every existing feature route keeps
 * working unchanged and is scoped to the account's user id.
 */
import { cookies, headers } from "next/headers";
import { createHash, randomBytes, randomUUID } from "crypto";
import { and, eq, gt, lt, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { profiles, refreshTokens, users } from "@/db/schema";
import { ApiError, rateLimit } from "./http";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

export type Role = "student" | "faculty" | "admin";
export type AuthUser = { id: string; email: string; name: string; role: Role };

export const WORKSPACE_COOKIE = "cg_workspace";
const WORKSPACE_TTL_DAYS = 365;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");

export function hasRole(user: AuthUser | null, ...roles: Role[]) {
  return !!user && roles.includes(user.role);
}

// SameSite=None + Secure + Partitioned so the cookie is also kept when the site runs inside an
// embedded (cross-site) preview frame; otherwise every request would open a new workspace.
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  partitioned: true,
  path: "/",
  maxAge: WORKSPACE_TTL_DAYS * 86400,
});

async function findWorkspace(tokenHash: string) {
  const [row] = await db
    .select({ user: users })
    .from(refreshTokens)
    .innerJoin(users, eq(users.id, refreshTokens.userId))
    .where(and(eq(refreshTokens.tokenHash, tokenHash), gt(refreshTokens.expiresAt, new Date()), eq(users.isGuest, true)))
    .limit(1);
  return row?.user ?? null;
}

async function createWorkspace(tokenHash: string) {
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for")?.split(",")[0] ?? hdrs.get("x-real-ip") ?? "local").trim();
  rateLimit(`workspace:${ip}`, 30, 60 * 60_000);
  try {
    return await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ email: `workspace-${randomUUID()}@local.collegegear`, name: "Student", passwordHash: "!no-login", role: "student", isGuest: true, lastLoginAt: new Date() })
        .returning();
      await tx.insert(profiles).values({ userId: u.id });
      // Unique index on token_hash makes concurrent first requests race-safe.
      await tx.insert(refreshTokens).values({ userId: u.id, tokenHash, expiresAt: new Date(Date.now() + WORKSPACE_TTL_DAYS * 86400_000) });
      return u;
    });
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") return findWorkspace(tokenHash); // another request created it first
    throw e;
  }
}

/** Current user: the signed-in account if there is a valid session, otherwise the anonymous workspace. */
export async function requireUser(): Promise<AuthUser> {
  const session = await readSession();
  if (session) {
    const u = session.user;
    if (!u.lastLoginAt || Date.now() - u.lastLoginAt.getTime() > 3600_000) {
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
    }
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  }
  return requireWorkspace();
}

/** Resolves (or transparently creates) the current browser's workspace owner. Never asks for credentials. */
export async function requireWorkspace(): Promise<AuthUser> {
  const jar = await cookies();
  let token = jar.get(WORKSPACE_COOKIE)?.value;
  if (!token || !TOKEN_RE.test(token)) {
    // Browsers that block the cookie (e.g. inside an embedded preview frame) send the same
    // workspace token in this header instead (see src/lib/api.ts), so their data stays reachable.
    const headerToken = (await headers()).get("x-workspace-token");
    token = headerToken && TOKEN_RE.test(headerToken) ? headerToken : randomToken();
    jar.set(WORKSPACE_COOKIE, token, cookieOptions());
  }
  const tokenHash = sha256(token);
  const u = (await findWorkspace(tokenHash)) ?? (await createWorkspace(tokenHash));
  if (!u) throw new ApiError(500, "WORKSPACE_ERROR", "Could not open your workspace. Please try again.");
  if (!u.isActive) throw new ApiError(403, "WORKSPACE_DISABLED", "This workspace has been disabled by an administrator.");
  // Track activity (at most once per hour) for admin analytics.
  if (!u.lastLoginAt || Date.now() - u.lastLoginAt.getTime() > 3600_000) {
    await db.update(users).set({ lastLoginAt: new Date() }).where(and(eq(users.id, u.id), or(isNull(users.lastLoginAt), lt(users.lastLoginAt, new Date(Date.now() - 3600_000)))));
  }
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

/**
 * Admin tools are open to every visitor (no login). Set ADMIN_PANEL_ENABLED=false
 * on a public deployment to switch them off.
 */
export async function requireAdminPanel(): Promise<AuthUser> {
  if (process.env.ADMIN_PANEL_ENABLED === "false") throw new ApiError(403, "ADMIN_DISABLED", "Admin tools are disabled on this deployment.");
  return requireUser();
}

/* ------------------------------------------------------------------ */
/* Optional accounts: bcrypt passwords + JWT session cookie            */
/* ------------------------------------------------------------------ */
export const AUTH_COOKIE = "cg_auth";
const AUTH_TTL_DAYS = 7;

let ephemeralSecret: Uint8Array | null = null;
/** JWT signing secret from the JWT_SECRET env var (never hard-coded, never sent to the browser). */
function jwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(48);
    console.warn("[auth] JWT_SECRET is missing or shorter than 32 characters. Using a random per-process secret, so logins reset when the server restarts. Set JWT_SECRET.");
  }
  return ephemeralSecret;
}

// Same cookie attributes as the workspace cookie (HttpOnly, Secure, SameSite=None, Partitioned), 7-day lifetime.
const authCookieOptions = () => ({ ...cookieOptions(), maxAge: AUTH_TTL_DAYS * 86400 });
// Prefixed hash so an auth session id can never be used as an anonymous workspace token (and vice versa).
const sessionHash = (sid: string) => sha256("auth:" + sid);

export type AccountUser = { id: string; name: string; email: string; role: Role; createdAt: Date; lastLoginAt: Date | null };
export const toAccount = (u: typeof users.$inferSelect): AccountUser => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt });

const normalizePassword = (pw: string) => pw.normalize("NFC").trim();
/** Hashes exactly once, at registration / password change (bcrypt, cost 12). */
export const hashPassword = (pw: string) => bcrypt.hash(normalizePassword(pw), 12);
/** Compares the plaintext password with the stored bcrypt hash (as typed first, then normalised). */
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  if (!hash.startsWith("$2")) return false; // anonymous workspaces have no password
  for (const candidate of new Set([pw, normalizePassword(pw)])) {
    if (candidate && (await bcrypt.compare(candidate, hash))) return true;
  }
  return false;
}

/** Creates a server-side session and sets the signed JWT cookie. Call only after successful authentication. */
export async function startSession(userId: string) {
  const sid = randomToken();
  await db.insert(refreshTokens).values({ userId, tokenHash: sessionHash(sid), expiresAt: new Date(Date.now() + AUTH_TTL_DAYS * 86400_000) });
  const jwt = await new SignJWT({ sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("college-gear")
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TTL_DAYS}d`)
    .sign(jwtSecret());
  (await cookies()).set(AUTH_COOKIE, jwt, authCookieOptions());
}

/** Verifies the JWT signature/expiry AND that its session still exists for an active registered account. */
async function readSession(): Promise<{ user: typeof users.$inferSelect; sid: string } | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { issuer: "college-gear", algorithms: ["HS256"] });
    const sid = typeof payload.sid === "string" ? payload.sid : null;
    if (!sid || !payload.sub) return null;
    const [row] = await db
      .select({ user: users })
      .from(refreshTokens)
      .innerJoin(users, eq(users.id, refreshTokens.userId))
      .where(and(eq(refreshTokens.tokenHash, sessionHash(sid)), eq(refreshTokens.userId, payload.sub), gt(refreshTokens.expiresAt, new Date()), eq(users.isGuest, false), eq(users.isActive, true)))
      .limit(1);
    return row ? { user: row.user, sid } : null;
  } catch {
    return null; // invalid/expired token: treat as a public visitor, never crash
  }
}

/** The signed-in account, or null for public visitors. */
export async function getAccount(): Promise<AccountUser | null> {
  const s = await readSession();
  return s ? toAccount(s.user) : null;
}

/** Guard for account-only endpoints. */
export async function requireAccount(): Promise<AccountUser> {
  const a = await getAccount();
  if (!a) throw new ApiError(401, "UNAUTHORIZED", "Please log in to access your account.");
  return a;
}

/** Logout: revokes the server-side session and clears the cookie. Never deletes the account or its data. */
export async function endSession() {
  const s = await readSession();
  if (s) await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, sessionHash(s.sid)));
  (await cookies()).set(AUTH_COOKIE, "", { ...authCookieOptions(), maxAge: 0 });
}

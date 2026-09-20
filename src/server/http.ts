import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";

/** Typed application error mapped to the standard error envelope. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const Errors = {
  badRequest: (msg = "Bad request", details?: unknown) => new ApiError(400, "BAD_REQUEST", msg, details),
  unauthorized: (msg = "Authentication required") => new ApiError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "You do not have permission to perform this action") => new ApiError(403, "FORBIDDEN", msg),
  notFound: (msg = "Resource not found") => new ApiError(404, "NOT_FOUND", msg),
  conflict: (msg = "Conflict") => new ApiError(409, "CONFLICT", msg),
  tooMany: (msg = "Too many requests. Please slow down.") => new ApiError(429, "RATE_LIMITED", msg),
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

/** Centralised error handler — never leaks stack traces or internal messages. */
export function handleError(err: unknown) {
  if (err instanceof ApiError) return fail(err.status, err.code, err.message, err.details);
  if (err instanceof ZodError) {
    return fail(
      400,
      "VALIDATION_ERROR",
      err.issues[0] ? `${err.issues[0].path.join(".") || "input"}: ${err.issues[0].message}` : "Invalid input",
      err.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }
  const pgCode = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
  if (pgCode === "23505") return fail(409, "CONFLICT", "A record with these details already exists");
  if (pgCode === "23503") return fail(400, "INVALID_REFERENCE", "Referenced record does not exist");
  if (pgCode === "22P02") return fail(400, "INVALID_ID", "Invalid identifier format");
  console.error("[api] unhandled error:", err);
  return fail(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export async function parseBody<S extends z.ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw Errors.badRequest("Request body must be valid JSON");
  }
  return schema.parse(json);
}

export function getIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

/* ------------------------------------------------------------------ */
/* In-memory fixed-window rate limiter (per process)                   */
/* ------------------------------------------------------------------ */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return;
  }
  b.count++;
  if (b.count > limit) throw Errors.tooMany(`Too many requests. Try again in ${Math.ceil((b.reset - now) / 1000)}s.`);
}

/* ------------------------------------------------------------------ */
/* Audit logging                                                       */
/* ------------------------------------------------------------------ */
export async function audit(
  userId: string | null,
  action: string,
  opts: { entity?: string; entityId?: string; metadata?: Record<string, unknown>; ip?: string } = {}
) {
  try {
    const [{ db }, { auditLogs }] = await Promise.all([import("@/db"), import("@/db/schema")]);
    await db.insert(auditLogs).values({
      userId,
      action,
      entity: opts.entity,
      entityId: opts.entityId,
      metadata: opts.metadata ?? null,
      ip: opts.ip,
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}

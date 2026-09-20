import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSeeded } from "@/server/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    void ensureSeeded();
    return Response.json({ ok: true, success: true, message: "COLLEGE GEAR API is running" });
  } catch {
    return Response.json({ ok: false, success: false, error: { code: "DB_UNAVAILABLE", message: "Database connection failed" } }, { status: 500 });
  }
}

/**
 * COLLEGE GEAR migration runner.
 * Applies every *.sql file in server/db/migrations (sorted) exactly once, inside a
 * transaction, tracking applied files in the schema_migrations table.
 *
 *   npm run db:migrate
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const dir = join(process.cwd(), "server", "db", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));

    // If the schema already exists (e.g. created by `drizzle-kit push`), mark the initial migration as applied.
    const { rows: existing } = await client.query<{ exists: boolean }>("SELECT to_regclass('public.users') IS NOT NULL AS exists");
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`✓ ${file} (already applied)`);
        continue;
      }
      if (file.startsWith("001_") && existing[0]?.exists) {
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        console.log(`✓ ${file} (schema already present — recorded as applied)`);
        continue;
      }
      const sql = readFileSync(join(dir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`✓ ${file} applied`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
      }
    }
    console.log("Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

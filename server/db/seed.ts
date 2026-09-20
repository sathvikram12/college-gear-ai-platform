/**
 * COLLEGE GEAR development/demo seed.
 * Inserts clearly-labelled demo quizzes (8 categories × 15 questions), interview questions,
 * placement records, news, announcements, resources, forum categories and an admin account.
 * Idempotent: guarded by an advisory lock and a `system.seed` marker row.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { ensureSeeded } from "../../src/server/seed";
import { pool } from "../../src/db";

ensureSeeded()
  .then(async () => {
    console.log("Seed complete (skipped automatically if already seeded).");
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });

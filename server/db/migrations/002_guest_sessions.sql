-- =====================================================================
-- COLLEGE GEAR — 002_guest_sessions.sql
-- Additive, non-destructive: adds guest-session support to users.
-- Existing users are unaffected (is_guest defaults to false).
-- =====================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS users_guest_idx ON users USING btree (is_guest);

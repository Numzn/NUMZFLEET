-- Adds NUMZFLEET-native profile fields to numz_users (avatar, job info) for the
-- Settings Center Profile section. Traccar remains the source of truth for
-- name/email/password; these columns hold data Traccar has no concept of.
-- Idempotent; safe to re-run.
BEGIN;

ALTER TABLE numz_users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);
ALTER TABLE numz_users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);
ALTER TABLE numz_users ADD COLUMN IF NOT EXISTS department VARCHAR(255);

COMMIT;

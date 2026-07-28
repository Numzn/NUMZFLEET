-- Adds the one genuinely new (non-Traccar) preference for the Settings Center's
-- Preferences section — a NUMZFLEET-specific concept with no Traccar meaning,
-- so it can't live in Traccar's user.attributes like the other preferences.
-- Idempotent; safe to re-run.
BEGIN;

ALTER TABLE numz_users ADD COLUMN IF NOT EXISTS default_dashboard VARCHAR(50);

COMMIT;

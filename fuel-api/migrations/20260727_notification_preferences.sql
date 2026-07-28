-- Stores per-user notification preferences for the Settings Center's
-- Notifications section. Storage only — this does NOT wire enforcement into
-- publishNotification()/audienceResolver.js; that is a deliberate, separate
-- follow-up (see fuel-api/docs or the Settings Center plan for the boundary).
-- Idempotent; safe to re-run.
BEGIN;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numz_user_id UUID NOT NULL REFERENCES numz_users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  category VARCHAR(30) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (numz_user_id, channel, category)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_numz_user ON notification_preferences (numz_user_id);

COMMIT;

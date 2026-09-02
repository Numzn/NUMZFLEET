-- Stores Web Push subscriptions per user. One row per device/browser — a
-- user can have several (phone + laptop, etc.), unlike notification_preferences
-- which is one row per (user, channel, category). Endpoint URLs are unique
-- per browser+device+origin registration, so UNIQUE(endpoint) both enforces
-- that and gives re-subscribing on the same device a natural upsert target.
-- Idempotent; safe to re-run.
BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numz_user_id UUID NOT NULL REFERENCES numz_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(512),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_numz_user ON push_subscriptions (numz_user_id);

COMMIT;

-- Phase 6: push subscription lifecycle.
--
-- Today pushChannel.js hard-deletes a subscription the instant the push
-- service reports it gone (404/410, RFC 8030) via removeByEndpoint(). That
-- loses the row entirely — there is nothing left to show "this device used
-- to be registered, and here is why it stopped" — and, per
-- notification_delivery_attempts.target_id's own comment, is the reason that
-- column was deliberately NOT a foreign key: attempt history already
-- survives a subscription's deletion.
--
-- This migration adds a soft-deactivation lane alongside the existing
-- hard-delete path. It does not remove hard-delete capability (a user
-- explicitly disabling push on their own device — removeForNumzUser — stays
-- a real delete; that is the user asking for their own row to be gone, not
-- provider evidence of a dead endpoint). Only the provider-driven expiry path
-- changes to deactivate instead of delete.
--
-- status is a plain VARCHAR with no CHECK, matching every other status
-- column in this codebase (notifications.severity, notification_deliveries.status,
-- etc.) — validation lives in application code so a new status value never
-- needs a migration.
--
-- Idempotent; safe to re-run.
-- Reverse:
--   ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS status;
--   ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS deactivated_at;
--   ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS deactivation_reason;
--   DROP INDEX IF EXISTS idx_push_subscriptions_active;
BEGIN;

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(64);

-- listForNumzUser (the send-time lookup) filters to active only — this is
-- the index that query actually needs, partial so dead rows (expected to
-- accumulate as real audit history) never bloat it.
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
  ON push_subscriptions (numz_user_id)
  WHERE status = 'active';

COMMIT;

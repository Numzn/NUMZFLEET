-- Phase 7: escalation & acknowledgement-driven workflows.
--
-- `mandatory` closes a real gap from Phase 5: the delivery planner already
-- consumes a `mandatory` flag at publish time (canonicalNotification.js/
-- publishNotification.js), but it was never persisted onto the notification
-- row itself — there was no reader that needed it after the fact. Phase 7 is
-- that reader: it must be able to find "mandatory, still-unacknowledged"
-- notifications well after publish time, which requires the flag to survive
-- past the publish request. Defaults to false — every notification published
-- before this migration (and everything published by a policy that never
-- sets `mandatory: true`, which today is every policy) is unaffected.
--
-- `escalated_at` records whether (and when) a notification's one-time
-- escalation already fired — the idempotency guard so a slow-running
-- reconciliation-style scheduler tick can never re-escalate the same
-- notification twice. Mirrors the shape of viewed_at/acknowledged_at/
-- resolved_at already on this table rather than introducing a separate
-- escalations table: one nullable timestamp is the entire piece of state
-- escalation needs to track for now (no need yet, per Phase 7's own scope,
-- to add more than the fact that it has happened once).
--
-- Idempotent; safe to re-run.
-- Reverse:
--   ALTER TABLE notifications DROP COLUMN IF EXISTS mandatory;
--   ALTER TABLE notifications DROP COLUMN IF EXISTS escalated_at;
--   DROP INDEX IF EXISTS idx_notifications_escalation_candidates;
BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS mandatory BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- The escalation scheduler's own claim query: mandatory, urgency='immediate',
-- never acknowledged, never already escalated. Partial so settled/non-
-- mandatory notifications (the overwhelming majority) never enter this index
-- at all.
CREATE INDEX IF NOT EXISTS idx_notifications_escalation_candidates
  ON notifications (created_at)
  WHERE mandatory = true AND urgency = 'immediate' AND acknowledged_at IS NULL AND escalated_at IS NULL;

COMMIT;

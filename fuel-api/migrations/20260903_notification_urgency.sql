-- Adds delivery urgency to notifications, separate from severity.
--
-- severity answers "how serious is this event" (info/success/warning/critical)
-- and already exists. urgency answers "how fast must this reach a human"
-- (immediate/normal/deferred) and did not exist — until now the two were
-- conflated, with the frontend deriving push/sound behavior straight from
-- severity. Nothing consumes urgency for channel selection yet; this phase
-- only establishes and persists the vocabulary.
--
-- Existing rows are backfilled with the same default the application applies
-- (critical -> immediate, everything else -> normal), so historical rows read
-- back identically to how newly-written ones would.
--
-- Idempotent; safe to re-run.
-- Reverse: ALTER TABLE notifications DROP COLUMN IF EXISTS urgency;
BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS urgency VARCHAR(16) NOT NULL DEFAULT 'normal';

UPDATE notifications
   SET urgency = 'immediate'
 WHERE severity = 'critical'
   AND urgency = 'normal';

-- Supports "which critical/immediate notifications are still unacknowledged",
-- the query escalation will run in a later phase.
CREATE INDEX IF NOT EXISTS idx_notifications_urgency_unacked
  ON notifications (urgency, acknowledged_at)
  WHERE archived = false;

COMMIT;

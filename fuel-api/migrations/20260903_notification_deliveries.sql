-- Durable delivery records (Phase 2 of the notification platform).
--
-- Three levels, deliberately not collapsed into one overloaded row:
--
--   notifications                      already IS (notification x recipient) —
--                                      publishNotification writes one row per
--                                      user, deduped by (user_id, client_dedup_key).
--                                      No separate recipient table is created.
--     -> notification_deliveries       one LOGICAL delivery per (notification, channel).
--     -> notification_delivery_attempts one PHYSICAL send: a device target and/or
--                                      a retry. Push fans out to every registered
--                                      subscription, so one push delivery can have
--                                      several attempts without ever becoming
--                                      several notifications.
--
-- Identity: UNIQUE(notification_id, channel) on deliveries. No nullable column
-- participates in that key, so it cannot suffer the "every NULL is distinct"
-- hole a (notification, channel, target) key would have had for the channels
-- that have no target.
--
-- Tenancy: company_id is denormalized onto BOTH tables and NOT NULL. The Phase 3
-- worker and any future provider webhook process deliveries outside the original
-- HTTP request, so tenant ownership must be readable without joining back up to
-- notifications.
--
-- This migration is additive and changes no existing behavior: nothing reads
-- these tables yet, and notification delivery continues exactly as before.
--
-- Idempotent; safe to re-run.
-- Reverse:
--   DROP TABLE IF EXISTS notification_delivery_attempts;
--   DROP TABLE IF EXISTS notification_deliveries;
BEGIN;

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  -- Traccar user id, mirrored from notifications.user_id. Denormalized for the
  -- same reason as company_id: the worker should not need a join to know who
  -- this is for.
  recipient_user_id INTEGER NOT NULL,
  channel VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  -- Plain VARCHAR with no CHECK, matching notifications.severity/urgency.
  -- Validation lives in deliveryStates.js so Phase 3 can add 'retrying'/
  -- 'expired' without a migration.
  attempt_count INTEGER NOT NULL DEFAULT 0,
  queued_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  -- Phase 3 fields, created now so the worker does not force a schema redesign.
  -- Nothing writes them in Phase 2.
  next_attempt_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(64),
  failure_code VARCHAR(64),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notification_id, channel)
);

CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES notification_deliveries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  -- The physical destination this attempt went to. For push this is the
  -- push_subscriptions row (one attempt per device). NULL for channels with a
  -- single implicit destination (sms/email/inbox/websocket).
  -- Intentionally NOT a foreign key: an expired subscription is hard-deleted by
  -- pushChannel.js per RFC 8030, and the attempt record must survive that as
  -- evidence of what was tried.
  target_type VARCHAR(32),
  target_id UUID,
  -- Deterministic: {delivery_id}:{target_id|default}:{attempt_number}.
  -- Never a timestamp or random value — it must be reproducible so a retry can
  -- recognise its own prior attempt.
  idempotency_key VARCHAR(255) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  provider VARCHAR(32),
  provider_message_id VARCHAR(255),
  failure_code VARCHAR(64),
  failure_reason TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (idempotency_key)
);

-- The Phase 3 worker's claim query: "pending/retrying work that is due".
-- Partial, so it stays small — settled deliveries leave the index entirely.
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_claim
  ON notification_deliveries (next_attempt_at, created_at)
  WHERE status IN ('pending', 'retrying');

-- Tenant-scoped reads (the Phase 6 observability surface, and any per-company
-- delivery report) must not scan the whole table.
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_company_status
  ON notification_deliveries (company_id, status);

-- "Show me every channel this notification went to" — the auditability query,
-- and how deliveries are loaded for a notification.
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON notification_deliveries (notification_id);

-- Attempts are almost always read for one delivery, newest first.
CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempts_delivery
  ON notification_delivery_attempts (delivery_id, attempt_number);

-- Provider webhook correlation (Phase 6): a callback arrives carrying only a
-- provider message id. Partial — most attempts never get one.
CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempts_provider_msg
  ON notification_delivery_attempts (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

COMMIT;

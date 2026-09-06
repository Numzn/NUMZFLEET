-- Code-review fix: deliveryRepository.js's own doc comment calls
-- (provider, provider_message_id) "the identity" for webhook/reconciliation
-- correlation, but the existing index (20260903_notification_deliveries.sql)
-- is a plain, non-unique partial index — nothing actually enforces that
-- identity claim. Confirmed via direct query before writing this migration:
-- no duplicate (provider, provider_message_id) pairs exist today, so this
-- applies cleanly.
--
-- Idempotent; safe to re-run.
-- Reverse:
--   DROP INDEX IF EXISTS idx_notification_delivery_attempts_provider_msg_unique;
--   CREATE INDEX idx_notification_delivery_attempts_provider_msg
--     ON notification_delivery_attempts (provider, provider_message_id)
--     WHERE provider_message_id IS NOT NULL;
BEGIN;

DROP INDEX IF EXISTS idx_notification_delivery_attempts_provider_msg;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_delivery_attempts_provider_msg_unique
  ON notification_delivery_attempts (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

COMMIT;

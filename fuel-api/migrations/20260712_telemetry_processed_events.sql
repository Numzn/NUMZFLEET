-- Idempotency ledger for the event-driven telemetry ingestion pipeline.
-- One row per Traccar tc_events.id ever processed (webhook or reconciliation),
-- so a re-delivered or re-scanned event is a no-op, not a duplicate transition.

BEGIN;

CREATE TABLE IF NOT EXISTS telemetry_processed_events (
  event_id BIGINT PRIMARY KEY,
  "deviceId" INTEGER,
  "eventType" VARCHAR(32),
  "vehicleId" UUID,
  outcome VARCHAR(24) NOT NULL,
  "processedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_processed_events_processed_at
  ON telemetry_processed_events ("processedAt");

COMMIT;

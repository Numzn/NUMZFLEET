-- Audit trail for self-healing corrections to vehicle_activity_state, so a
-- future "why does this vehicle show the wrong duration" investigation has a
-- persistent, queryable record instead of relying on log retention. Only
-- genuine corrections are recorded here (health-check-triggered repairs, or
-- anything the periodic/startup reconciliation sweep had to fix) — routine
-- transitions detected live via the webhook stay covered by the existing
-- telemetry.ingest.processed log line and VEHICLE_STATE_CHANGED domain event.

BEGIN;

CREATE TABLE IF NOT EXISTS vehicle_state_audit_events (
  id SERIAL PRIMARY KEY,
  "vehicleId" UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  "previousState" VARCHAR(16),
  "correctedState" VARCHAR(16) NOT NULL,
  "previousStateEnteredAt" TIMESTAMPTZ,
  "correctedStateEnteredAt" TIMESTAMPTZ NOT NULL,
  reason VARCHAR(64) NOT NULL,
  source VARCHAR(32) NOT NULL,
  payload JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_state_audit_events_vehicle
  ON vehicle_state_audit_events ("vehicleId");

COMMIT;

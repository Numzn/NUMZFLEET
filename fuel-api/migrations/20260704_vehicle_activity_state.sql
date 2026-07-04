-- Canonical, persisted current activity state per vehicle (moving/idle/offline)
-- plus when the vehicle entered that state. Replaces the frontend-only,
-- session-scoped duration tracker that reset on every page reload.

BEGIN;

CREATE TABLE IF NOT EXISTS vehicle_activity_state (
  id SERIAL PRIMARY KEY,
  "vehicleId" UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  "deviceId" INTEGER,
  state VARCHAR(16) NOT NULL,
  "stateEnteredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stateSource" VARCHAR(16) NOT NULL DEFAULT 'observed',
  "lastEvaluatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_activity_state_vehicle
  ON vehicle_activity_state ("vehicleId");

COMMIT;

-- Per-vehicle daily mileage ledger. Africa/Lusaka business day. Day-start
-- baseline is reconstructed from historical Traccar telemetry (not a live
-- scheduler sample), so it stays correct regardless of when the job runs.

BEGIN;

CREATE TABLE IF NOT EXISTS vehicle_daily_mileage (
  id SERIAL PRIMARY KEY,
  "vehicleId" UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  "localDate" DATE NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Lusaka',
  "dayStartOdometerKm" DOUBLE PRECISION,
  "dayStartSource" VARCHAR(24) NOT NULL DEFAULT 'unavailable',
  "dayStartEvidenceFixtime" TIMESTAMPTZ,
  "dayStartCapturedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latestOdometerKm" DOUBLE PRECISION,
  "latestOdometerConfidence" VARCHAR(16) NOT NULL DEFAULT 'unavailable',
  "latestCapturedAt" TIMESTAMPTZ,
  "distanceKm" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_daily_mileage_vehicle_date
  ON vehicle_daily_mileage ("vehicleId", "localDate");

COMMIT;

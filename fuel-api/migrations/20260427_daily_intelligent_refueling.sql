BEGIN;

ALTER TABLE operation_sessions
  ADD COLUMN IF NOT EXISTS "totalEstimatedFuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalActualFuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalEstimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalActualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalVarianceCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalsFrozenAt" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'enum_operation_session_refuels_status'
  ) THEN
    CREATE TYPE enum_operation_session_refuels_status AS ENUM ('normal', 'warning', 'flagged');
  END IF;
END$$;

ALTER TABLE operation_session_refuels
  ADD COLUMN IF NOT EXISTS "estimatedFuelLitres" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "actualFuelLitres" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "varianceLitres" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "variancePercent" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS status enum_operation_session_refuels_status NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS "erbPricePerLitre" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "estimatedCost" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "actualCost" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "tankLevelStart" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "tankCapacitySnapshot" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "meterFuelLitres" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "meterVariance" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "plannedFuelLitres" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_operation_session_refuels_session_vehicle
  ON operation_session_refuels ("sessionId", "vehicleId");

CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_sessions_one_active_per_user
  ON operation_sessions ("userId")
  WHERE status = 'active';

COMMIT;

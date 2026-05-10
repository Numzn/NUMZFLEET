-- Baseline: operation_sessions + operation_session_refuels (idempotent).
-- Use when Postgres exists but Sequelize sync never created these tables (e.g. degraded startup).
-- If tables already exist, this is a no-op. For incremental column adds, run 20260427 / 20260429 after.

BEGIN;

DO $$ BEGIN
  CREATE TYPE enum_operation_sessions_status AS ENUM ('active', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_operation_session_refuels_status AS ENUM ('normal', 'warning', 'flagged', 'incomplete');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS operation_sessions (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  name VARCHAR(120),
  "sessionDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  status enum_operation_sessions_status NOT NULL DEFAULT 'active',
  "totalEstimatedFuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalActualFuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalEstimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalActualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalVarianceCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalsFrozenAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS operation_sessions_user_id ON operation_sessions ("userId");
CREATE INDEX IF NOT EXISTS operation_sessions_session_date ON operation_sessions ("sessionDate");
CREATE INDEX IF NOT EXISTS operation_sessions_status ON operation_sessions (status);

CREATE TABLE IF NOT EXISTS operation_session_refuels (
  id SERIAL PRIMARY KEY,
  "sessionId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "vehicleId" INTEGER NOT NULL,
  "fuelCost" DOUBLE PRECISION NOT NULL,
  "fuelAmount" DOUBLE PRECISION NOT NULL,
  "estimatedFuelLitres" DOUBLE PRECISION,
  "actualFuelLitres" DOUBLE PRECISION,
  "varianceLitres" DOUBLE PRECISION,
  "variancePercent" DOUBLE PRECISION,
  status enum_operation_session_refuels_status NOT NULL DEFAULT 'normal',
  "erbPricePerLitre" DOUBLE PRECISION,
  "estimatedCost" DOUBLE PRECISION,
  "actualCost" DOUBLE PRECISION,
  "tankLevelStart" DOUBLE PRECISION,
  "tankCapacitySnapshot" DOUBLE PRECISION,
  "meterFuelLitres" DOUBLE PRECISION,
  "meterVariance" DOUBLE PRECISION,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  "currentMileage" DOUBLE PRECISION,
  attendant VARCHAR(120),
  "pumpNumber" VARCHAR(60),
  "sessionDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS operation_session_refuels_session_id ON operation_session_refuels ("sessionId");
CREATE INDEX IF NOT EXISTS operation_session_refuels_vehicle_id ON operation_session_refuels ("vehicleId");
CREATE INDEX IF NOT EXISTS operation_session_refuels_session_date ON operation_session_refuels ("sessionDate");
CREATE INDEX IF NOT EXISTS idx_operation_session_refuels_session_vehicle
  ON operation_session_refuels ("sessionId", "vehicleId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'operation_session_refuels_sessionId_fkey'
  ) THEN
    ALTER TABLE operation_session_refuels
      ADD CONSTRAINT operation_session_refuels_sessionId_fkey
      FOREIGN KEY ("sessionId") REFERENCES operation_sessions (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_sessions_one_active_per_user
  ON operation_sessions ("userId")
  WHERE status = 'active';

COMMIT;

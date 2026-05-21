-- Vehicle immobilization operational intents (safety-governed, idempotent).
BEGIN;

DO $$ BEGIN
  CREATE TYPE enum_vehicle_immobilization_action AS ENUM ('immobilize', 'mobilize');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_vehicle_immobilization_status AS ENUM (
    'pending',
    'monitoring',
    'executing',
    'completed',
    'failed',
    'expired',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_vehicle_immobilization_confidence AS ENUM (
    'unknown',
    'acknowledged',
    'relay_reported',
    'unverified'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vehicle_immobilization_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId" UUID NOT NULL,
  "deviceId" INTEGER NOT NULL,
  action enum_vehicle_immobilization_action NOT NULL,
  status enum_vehicle_immobilization_status NOT NULL DEFAULT 'pending',
  "createdByUserId" INTEGER NOT NULL,
  "cancelledByUserId" INTEGER,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "gateSnapshot" JSONB NOT NULL DEFAULT '{}',
  "traccarCommandType" VARCHAR(64),
  "traccarCommandPayload" JSONB,
  "executionStartedAt" TIMESTAMPTZ,
  "executionCompletedAt" TIMESTAMPTZ,
  "executionError" TEXT,
  confidence enum_vehicle_immobilization_confidence NOT NULL DEFAULT 'unknown',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS vehicle_immobilization_intents_vehicle_id
  ON vehicle_immobilization_intents ("vehicleId");
CREATE INDEX IF NOT EXISTS vehicle_immobilization_intents_status
  ON vehicle_immobilization_intents (status);
CREATE INDEX IF NOT EXISTS vehicle_immobilization_intents_expires_at
  ON vehicle_immobilization_intents ("expiresAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname IN (
      'vehicle_immobilization_intents_vehicleid_fkey',
      'vehicle_immobilization_intents_vehicleId_fkey'
    )
  ) THEN
    ALTER TABLE vehicle_immobilization_intents
      ADD CONSTRAINT vehicle_immobilization_intents_vehicleId_fkey
      FOREIGN KEY ("vehicleId") REFERENCES vehicles (id) ON DELETE CASCADE;
  END IF;
END $$;

-- One active intent per vehicle (pending, monitoring, or executing).
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_immobilization_intents_one_active_per_vehicle
  ON vehicle_immobilization_intents ("vehicleId")
  WHERE status IN ('pending', 'monitoring', 'executing');

COMMIT;

-- P0 execution integrity: delivery metadata + confidence 'sent' (idempotent).
BEGIN;

ALTER TABLE vehicle_immobilization_intents
  ADD COLUMN IF NOT EXISTS "executionAttempt" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE vehicle_immobilization_intents
  ADD COLUMN IF NOT EXISTS "traccarDeliveryAt" TIMESTAMPTZ;

ALTER TABLE vehicle_immobilization_intents
  ADD COLUMN IF NOT EXISTS "traccarHttpStatus" INTEGER;

ALTER TABLE vehicle_immobilization_intents
  ADD COLUMN IF NOT EXISTS "deliveryPhase" VARCHAR(32);

DO $$ BEGIN
  ALTER TYPE enum_vehicle_immobilization_confidence ADD VALUE 'sent';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

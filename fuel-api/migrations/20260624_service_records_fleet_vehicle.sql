-- Align service_records with fleet vehicle UUID identity and tenant UUID.
-- Idempotent; safe to re-run.

BEGIN;

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "fleetVehicleId" UUID;

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "deviceId" INTEGER;

-- Copy legacy Traccar device id from vehicleId when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_records' AND column_name = 'vehicleId'
  ) THEN
    UPDATE service_records
    SET "deviceId" = "vehicleId"
    WHERE "deviceId" IS NULL AND "vehicleId" IS NOT NULL;
  END IF;
END $$;

-- Link rows to fleet vehicles via active device assignment.
UPDATE service_records sr
SET "fleetVehicleId" = da."vehicleId"
FROM device_assignments da
WHERE da."deviceId" = sr."deviceId"
  AND da."isActive" = true
  AND sr."fleetVehicleId" IS NULL;

-- Migrate companyId INTEGER → UUID (default fleet company).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_records'
      AND column_name = 'companyId'
      AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE service_records
      ALTER COLUMN "companyId" TYPE UUID
      USING '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;
END $$;

-- Drop legacy vehicleId column once deviceId is populated.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_records' AND column_name = 'vehicleId'
  ) THEN
    ALTER TABLE service_records RENAME COLUMN "vehicleId" TO "_deprecated_vehicleId";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_records_fleet_vehicle_id_fkey'
  ) THEN
    ALTER TABLE service_records
      ADD CONSTRAINT service_records_fleet_vehicle_id_fkey
      FOREIGN KEY ("fleetVehicleId") REFERENCES vehicles (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_records_company_fleet_vehicle
  ON service_records ("companyId", "fleetVehicleId");

COMMIT;

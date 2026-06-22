-- Maintenance work orders (lite): per-vehicle service log with cost, vendor,
-- and lifecycle status. Created manually or from a Traccar maintenance event.

BEGIN;

CREATE TABLE IF NOT EXISTS service_records (
  id SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "vehicleId" INTEGER NOT NULL,
  "maintenanceId" INTEGER,
  title VARCHAR(160) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  "odometerKm" DOUBLE PRECISION,
  cost DOUBLE PRECISION,
  vendor VARCHAR(160),
  notes TEXT,
  "dueAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "createdBy" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_records_company_vehicle
  ON service_records ("companyId", "vehicleId");

CREATE INDEX IF NOT EXISTS idx_service_records_status
  ON service_records (status);

COMMIT;

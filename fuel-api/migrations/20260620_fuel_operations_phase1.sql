-- Fuel Operations Phase 1: station name + per-fuel-type price snapshots on the
-- Fuel Day, fuel-type snapshot per refuel, manual invoice reconciliation table,
-- and verified-odometer baseline columns on vehicle_specs.
-- Idempotent: safe to re-run (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).

BEGIN;

-- Fuel Day metadata + per-type ERB price snapshot
ALTER TABLE operation_sessions
  ADD COLUMN IF NOT EXISTS "stationName" VARCHAR(160),
  ADD COLUMN IF NOT EXISTS "approvedDieselPrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "approvedPetrolPrice" DOUBLE PRECISION;

-- Fuel type captured at plan time (drives per-litre pricing and breakdown)
ALTER TABLE operation_session_refuels
  ADD COLUMN IF NOT EXISTS "fuelTypeSnapshot" VARCHAR(32);

-- Manual invoice reconciliation (1:1 with a Fuel Day)
CREATE TABLE IF NOT EXISTS operation_session_invoices (
  id SERIAL PRIMARY KEY,
  "operationId" INTEGER NOT NULL REFERENCES operation_sessions(id) ON DELETE CASCADE,
  company_id UUID,
  "invoiceNumber" VARCHAR(120),
  "invoiceDate" DATE,
  "dieselLitres" DOUBLE PRECISION,
  "petrolLitres" DOUBLE PRECISION,
  "totalLitres" DOUBLE PRECISION,
  "totalCost" DOUBLE PRECISION,
  "reconciliationStatus" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "varianceLitres" DOUBLE PRECISION,
  "varianceCost" DOUBLE PRECISION,
  "enteredBy" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_session_invoices_operation_id
  ON operation_session_invoices ("operationId");

-- Verified odometer baseline (anchor + Traccar distance at verification)
ALTER TABLE vehicle_specs
  ADD COLUMN IF NOT EXISTS "verifiedOdometerKm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "verifiedOdometerAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "verifiedOdometerSource" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "verifiedTraccarDistance" DOUBLE PRECISION;

COMMIT;

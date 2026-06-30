-- Maintenance Operations Center Phase 1: work order fields + company budget.

BEGIN;

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "workOrderNumber" VARCHAR(32);

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS priority VARCHAR(8);

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS workshop VARCHAR(160);

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS assignee VARCHAR(160);

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "estimatedCost" DOUBLE PRECISION;

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "actualCost" DOUBLE PRECISION;

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "labourCost" DOUBLE PRECISION;

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "partsCost" DOUBLE PRECISION;

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "otherCost" DOUBLE PRECISION;

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "scheduledDueDate" TIMESTAMPTZ;

-- Migrate legacy cost into actualCost where not yet set.
UPDATE service_records
SET "actualCost" = cost
WHERE cost IS NOT NULL AND "actualCost" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_records_company_work_order_number
  ON service_records ("companyId", "workOrderNumber")
  WHERE "workOrderNumber" IS NOT NULL;

CREATE TABLE IF NOT EXISTS maintenance_budgets (
  "companyId" UUID PRIMARY KEY,
  "monthlyBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'ZMW',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO maintenance_budgets ("companyId", "monthlyBudget", currency, "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 350000, 'ZMW', CURRENT_TIMESTAMP)
ON CONFLICT ("companyId") DO NOTHING;

COMMIT;

-- Fueling Day Phase 2: allow multiple Smart Invoices per Fuel Day and track when
-- a vehicle arrived at the pump (independent of fuel being dispensed).
-- Idempotent: safe to re-run.
--   * Removes the 1:1 unique index/constraint on operation_session_invoices.operationId
--     so a Fuel Day can carry several invoices, and replaces it with a plain lookup index.
--   * Adds operation_session_refuels.arrivedAt.

BEGIN;

-- Replace the unique index with a non-unique lookup index so multiple invoices
-- can share an operationId. DROP INDEX / DROP CONSTRAINT are non-destructive of data.
DROP INDEX IF EXISTS idx_operation_session_invoices_operation_id;
DROP INDEX IF EXISTS operation_session_invoices_operation_id;

-- A column-level unique (operationId) constraint may also exist from an older
-- Sequelize sync. Remove it if present without failing when it is absent.
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'operation_session_invoices'
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) ILIKE '%("operationId")%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE operation_session_invoices DROP CONSTRAINT %I', conname);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_operation_session_invoices_operation_id
  ON operation_session_invoices ("operationId");

-- Vehicle arrived at the pump (Selected -> Arrived) ahead of fuel being recorded.
ALTER TABLE operation_session_refuels
  ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMPTZ;

COMMIT;

-- Fueling Day attachment coverage: one Smart Invoice attachment may cover one
-- or many fueled vehicles (refuel rows) within the same session, and a refuel
-- row may later be referenced by more than one attachment. Real foreign keys,
-- no comma-separated ids / JSON arrays / vehicle-name matching.
-- Idempotent: safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS operation_session_invoice_refuels (
  id SERIAL PRIMARY KEY,
  "invoiceId" INTEGER NOT NULL REFERENCES operation_session_invoices(id) ON DELETE CASCADE,
  "refuelId" INTEGER NOT NULL REFERENCES operation_session_refuels(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_op_session_invoice_refuels_unique
  ON operation_session_invoice_refuels ("invoiceId", "refuelId");

CREATE INDEX IF NOT EXISTS idx_op_session_invoice_refuels_invoice_id
  ON operation_session_invoice_refuels ("invoiceId");

CREATE INDEX IF NOT EXISTS idx_op_session_invoice_refuels_refuel_id
  ON operation_session_invoice_refuels ("refuelId");

-- The table may already exist without FKs if it was auto-created by a Sequelize
-- sync before this migration ran. Add them explicitly, idempotently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'operation_session_invoice_refuels_invoice_id_fkey'
  ) THEN
    ALTER TABLE operation_session_invoice_refuels
      ADD CONSTRAINT operation_session_invoice_refuels_invoice_id_fkey
      FOREIGN KEY ("invoiceId") REFERENCES operation_session_invoices(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'operation_session_invoice_refuels_refuel_id_fkey'
  ) THEN
    ALTER TABLE operation_session_invoice_refuels
      ADD CONSTRAINT operation_session_invoice_refuels_refuel_id_fkey
      FOREIGN KEY ("refuelId") REFERENCES operation_session_refuels(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;

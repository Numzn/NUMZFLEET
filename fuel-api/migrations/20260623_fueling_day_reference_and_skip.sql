-- Fueling Day operations-language reframe:
--   * Adds a human-friendly reference (FD-YYYYMMDD-NNN) to every Fuel Day so
--     operators never see the internal numeric session id.
--   * Adds explicit "Skipped" vehicle workflow fields to refuel lines.
-- Idempotent: safe to re-run.

BEGIN;

ALTER TABLE operation_sessions
  ADD COLUMN IF NOT EXISTS reference VARCHAR(32);

ALTER TABLE operation_session_refuels
  ADD COLUMN IF NOT EXISTS "skippedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "skippedBy" INTEGER,
  ADD COLUMN IF NOT EXISTS "skipReason" TEXT;

-- Backfill references for existing Fuel Days, sequenced per company + calendar
-- day so each fleet reads FD-YYYYMMDD-001, -002, ... in creation order.
WITH numbered AS (
  SELECT
    id,
    'FD-' || to_char("calendarDate", 'YYYYMMDD') || '-' || lpad(
      (ROW_NUMBER() OVER (
        PARTITION BY COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), "calendarDate"
        ORDER BY id
      ))::text, 3, '0'
    ) AS ref
  FROM operation_sessions
  WHERE reference IS NULL
)
UPDATE operation_sessions s
SET reference = n.ref
FROM numbered n
WHERE s.id = n.id;

-- Unique per fleet (company-less deployments share one tenant bucket).
CREATE UNIQUE INDEX IF NOT EXISTS operation_sessions_company_reference_uniq
  ON operation_sessions (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), reference);

ALTER TABLE operation_sessions
  ALTER COLUMN reference SET NOT NULL;

COMMIT;

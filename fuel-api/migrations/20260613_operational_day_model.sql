-- Operational day model: draft/approved/locked, calendarDate, audit tables.
-- Data-safe for production: extends existing status enum in place (no DROP COLUMN/TYPE);
-- reassigns refuels to the keeper session before removing duplicate session rows.
--
-- Enum labels must be committed before use (PostgreSQL rule) — extensions run outside BEGIN.

ALTER TYPE enum_operation_sessions_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE enum_operation_sessions_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE enum_operation_sessions_status ADD VALUE IF NOT EXISTS 'locked';

BEGIN;

ALTER TABLE operation_sessions
  ADD COLUMN IF NOT EXISTS "calendarDate" DATE,
  ADD COLUMN IF NOT EXISTS "fleetTimezone" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "approvedBy" INTEGER,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "approvedFuelPrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "approvedBudget" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "approvedLitres" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "approvalVarianceExists" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE operation_sessions
SET "calendarDate" = ("sessionDate" AT TIME ZONE 'Africa/Lusaka')::date
WHERE "calendarDate" IS NULL;

UPDATE operation_sessions
SET "fleetTimezone" = 'Africa/Lusaka'
WHERE "fleetTimezone" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM operation_sessions WHERE "calendarDate" IS NULL) THEN
    ALTER TABLE operation_sessions ALTER COLUMN "calendarDate" SET NOT NULL;
  END IF;
END $$;

-- Map legacy status values to operational model (idempotent)
UPDATE operation_sessions
SET status = 'draft'::enum_operation_sessions_status
WHERE status::text = 'active';

UPDATE operation_sessions
SET status = 'locked'::enum_operation_sessions_status
WHERE status::text = 'closed';

ALTER TABLE operation_sessions
  ALTER COLUMN status SET DEFAULT 'draft';

-- Recover from a partial v2-column attempt without DROP COLUMN (rename only)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'operation_sessions'
      AND column_name = 'status_v2'
  ) THEN
    UPDATE operation_sessions
    SET status = (
      CASE status_v2::text
        WHEN 'draft' THEN 'draft'
        WHEN 'approved' THEN 'approved'
        WHEN 'locked' THEN 'locked'
        ELSE 'draft'
      END
    )::enum_operation_sessions_status
    WHERE status_v2 IS NOT NULL
      AND status::text IN ('active', 'closed');

    ALTER TABLE operation_sessions RENAME COLUMN status_v2 TO "_deprecated_status_v2";
  END IF;
END $$;

DROP INDEX IF EXISTS idx_operation_sessions_one_active_per_user;

-- Keep refuel rows: attach them to the newest session per (userId, calendarDate) before dedupe
UPDATE operation_session_refuels r
SET "sessionId" = sub.keeper_id
FROM (
  SELECT a.id AS dup_id, b.id AS keeper_id
  FROM operation_sessions a
  INNER JOIN operation_sessions b
    ON a."userId" = b."userId"
   AND a."calendarDate" = b."calendarDate"
   AND a.id < b.id
) sub
WHERE r."sessionId" = sub.dup_id;

-- Remove duplicate session rows only (refuels already moved to keeper)
DELETE FROM operation_sessions a
USING operation_sessions b
WHERE a."userId" = b."userId"
  AND a."calendarDate" = b."calendarDate"
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_sessions_user_calendar_date
  ON operation_sessions ("userId", "calendarDate");

ALTER TABLE operation_session_refuels
  ADD COLUMN IF NOT EXISTS "mileageSource" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "capturedBy" INTEGER,
  ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS operation_audit_events (
  id SERIAL PRIMARY KEY,
  "operationId" INTEGER NOT NULL REFERENCES operation_sessions(id) ON DELETE CASCADE,
  "eventType" VARCHAR(64) NOT NULL,
  "userId" INTEGER,
  payload JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_audit_events_operation_id
  ON operation_audit_events ("operationId");

CREATE INDEX IF NOT EXISTS idx_operation_audit_events_event_type
  ON operation_audit_events ("eventType");

CREATE TABLE IF NOT EXISTS operation_adjustments (
  id SERIAL PRIMARY KEY,
  "operationId" INTEGER NOT NULL REFERENCES operation_sessions(id) ON DELETE CASCADE,
  "refuelId" INTEGER REFERENCES operation_session_refuels(id) ON DELETE SET NULL,
  field VARCHAR(64) NOT NULL,
  "originalValue" TEXT,
  "newValue" TEXT NOT NULL,
  reason TEXT,
  "userId" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_adjustments_operation_id
  ON operation_adjustments ("operationId");

CREATE TABLE IF NOT EXISTS operation_unlocks (
  id SERIAL PRIMARY KEY,
  "operationId" INTEGER NOT NULL REFERENCES operation_sessions(id) ON DELETE CASCADE,
  "unlockedBy" INTEGER NOT NULL,
  "unlockedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  reason TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_unlocks_operation_id
  ON operation_unlocks ("operationId");

COMMIT;

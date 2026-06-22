-- Operational day model: DRAFT/APPROVED/LOCKED, calendarDate, audit tables.
-- Default timezone for backfill matches FLEET_TIMEZONE env (Africa/Lusaka).

BEGIN;

-- New status enum
DO $$ BEGIN
  CREATE TYPE enum_operation_sessions_status_v2 AS ENUM ('draft', 'approved', 'locked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- calendarDate + operational fields
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

-- Backfill calendarDate from sessionDate (Africa/Lusaka)
UPDATE operation_sessions
SET "calendarDate" = ("sessionDate" AT TIME ZONE 'Africa/Lusaka')::date
WHERE "calendarDate" IS NULL;

UPDATE operation_sessions
SET "fleetTimezone" = 'Africa/Lusaka'
WHERE "fleetTimezone" IS NULL;

ALTER TABLE operation_sessions
  ALTER COLUMN "calendarDate" SET NOT NULL;

-- Migrate status column to v2 enum
ALTER TABLE operation_sessions
  ADD COLUMN IF NOT EXISTS status_v2 enum_operation_sessions_status_v2;

UPDATE operation_sessions
SET status_v2 = CASE
  WHEN status::text = 'active' THEN 'draft'::enum_operation_sessions_status_v2
  WHEN status::text = 'closed' THEN 'locked'::enum_operation_sessions_status_v2
  ELSE 'draft'::enum_operation_sessions_status_v2
END
WHERE status_v2 IS NULL;

ALTER TABLE operation_sessions DROP COLUMN IF EXISTS status;
ALTER TABLE operation_sessions RENAME COLUMN status_v2 TO status;
ALTER TABLE operation_sessions ALTER COLUMN status SET NOT NULL;
ALTER TABLE operation_sessions ALTER COLUMN status SET DEFAULT 'draft';

DROP TYPE IF EXISTS enum_operation_sessions_status;

ALTER TYPE enum_operation_sessions_status_v2 RENAME TO enum_operation_sessions_status;

DROP INDEX IF EXISTS idx_operation_sessions_one_active_per_user;

-- Legacy model allowed many sessions per user; keep newest row per (userId, calendarDate).
DELETE FROM operation_sessions a
USING operation_sessions b
WHERE a."userId" = b."userId"
  AND a."calendarDate" = b."calendarDate"
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_operation_sessions_user_calendar_date
  ON operation_sessions ("userId", "calendarDate");

-- Refuel capture fields
ALTER TABLE operation_session_refuels
  ADD COLUMN IF NOT EXISTS "mileageSource" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "capturedBy" INTEGER,
  ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMPTZ;

-- Audit events
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

-- Adjustments
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

-- Supervisor unlocks
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

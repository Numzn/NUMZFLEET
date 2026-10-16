-- NUMZFLEET accepted tracker readings.
--
-- A tracker reports a cumulative counter, and until now every value was trusted as it arrived: one glitch
-- could inflate the odometer, a counter reset could freeze it, and the daily ledger and the odometer each
-- interpreted the raw counter on their own. This migration adds the memory needed to decide, once, which
-- readings are allowed to advance a vehicle's mileage -- so cumulative and daily mileage are derived from the
-- same accepted evidence (see docs/VEHICLE_OWNED_ODOMETER.md, "Accepted readings"). Raw positions stay in
-- Traccar exactly as received; nothing here rewrites them.
--
--   tracker_counter_state   per tracker: the accepted counter, the raw watermark it is measured against, the
--                           last Traccar position processed, and any quarantined readings awaiting
--                           confirmation. An operational cache: it is rebuilt from the next reading if lost.
--   mileage_reading_events  the audit log of every notable decision (quarantine, spike discarded, level shift
--                           or reset accepted, rollover, unit correction, long gap)
--   vehicle_daily_mileage   gains the confirmed / unattributed split, the evidence label and the revision
--                           audit. Existing rows are untouched and labelled 'legacy'.
--
-- ADDITIVE ONLY: no existing column is altered and no existing daily figure is rewritten, so the previous
-- release keeps working against the same database. Recovery:
-- migrations-rollback/20261017_accepted_mileage_readings.down.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS tracker_counter_state (
  device_id INTEGER PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_assignment_id UUID REFERENCES device_assignments(id) ON DELETE SET NULL,
  -- The vehicle-facing counter: continuous across resets and level shifts, never moved by a rejected reading.
  accepted_km DOUBLE PRECISION NOT NULL,
  -- The tracker's own counter at the same point (km, scale-corrected): what the next reading is compared to.
  raw_km DOUBLE PRECISION NOT NULL,
  -- Which position attribute the counter is read from, fixed at bootstrap so a device that sometimes sends
  -- `odometer` and sometimes only `totalDistance` can never flip scale mid-stream.
  attribute VARCHAR(16),
  -- Reconciliation: accepted_km - bootstrap_accepted_km must always equal applied_km, the total of the accepted
  -- increments that were written to the daily ledger. Both move in the same transaction.
  bootstrap_accepted_km DOUBLE PRECISION NOT NULL,
  applied_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  fix_time TIMESTAMPTZ NOT NULL,
  -- Last Traccar tc_positions.id processed. Positions are walked in ARRIVAL order, the order in which
  -- Traccar computes its own cumulative totalDistance.
  position_cursor BIGINT NOT NULL DEFAULT 0,
  position_id BIGINT,
  -- Quarantined readings waiting to be recognised as a spike or confirmed as a new level.
  pending JSONB,
  quarantined_total INTEGER NOT NULL DEFAULT 0,
  bootstrapped_at TIMESTAMPTZ NOT NULL,
  last_ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tracker_counter_state_accepted_nonneg CHECK (accepted_km >= 0),
  CONSTRAINT tracker_counter_state_raw_nonneg CHECK (raw_km >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tracker_counter_state_vehicle ON tracker_counter_state (vehicle_id);

CREATE TABLE IF NOT EXISTS mileage_reading_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_id INTEGER NOT NULL,
  device_assignment_id UUID,
  type VARCHAR(32) NOT NULL,
  reason VARCHAR(24),
  -- 'open' = a quarantine that has not been recognised as a spike or confirmed as a new level yet.
  status VARCHAR(16) NOT NULL DEFAULT 'info',
  jump_km DOUBLE PRECISION,
  accepted_km DOUBLE PRECISION,
  from_fix TIMESTAMPTZ,
  to_fix TIMESTAMPTZ,
  position_id BIGINT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mileage_reading_events_type_check CHECK (type IN (
    'quarantined', 'spike_discarded', 'level_shift_accepted', 'reset_accepted',
    'rollover', 'unit_corrected', 'span')),
  CONSTRAINT mileage_reading_events_status_check CHECK (status IN ('info', 'open', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_mileage_reading_events_vehicle ON mileage_reading_events (vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mileage_reading_events_device ON mileage_reading_events (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mileage_reading_events_open
  ON mileage_reading_events (device_id) WHERE status = 'open';

-- The daily ledger. confirmedKm: accepted distance placed inside this local day by continuous coverage.
-- unattributedKm: accepted distance that arrived across a long silence ending this day -- it is in the
-- vehicle's cumulative mileage but cannot be placed on any particular day, so it is kept apart and never
-- folded into the confirmed figure. A day with no row at all has UNKNOWN distance, never zero.
ALTER TABLE vehicle_daily_mileage
  ADD COLUMN IF NOT EXISTS "confirmedKm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "unattributedKm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS evidence VARCHAR(16) NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS "firstReadingAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastReadingAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "revisionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastRevisedAt" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vehicle_daily_mileage_evidence_check'
      AND conrelid = to_regclass('vehicle_daily_mileage')
  ) THEN
    ALTER TABLE vehicle_daily_mileage
      ADD CONSTRAINT vehicle_daily_mileage_evidence_check CHECK (evidence IN ('legacy', 'accepted'));
  END IF;
END $$;

-- Sequelize's sync() can create the new tables before this runs (documented race); re-state the foreign keys
-- so the end state is the same whichever path created them first.
ALTER TABLE tracker_counter_state DROP CONSTRAINT IF EXISTS tracker_counter_state_vehicle_id_fkey;
ALTER TABLE tracker_counter_state ADD CONSTRAINT tracker_counter_state_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE tracker_counter_state DROP CONSTRAINT IF EXISTS tracker_counter_state_company_id_fkey;
ALTER TABLE tracker_counter_state ADD CONSTRAINT tracker_counter_state_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE tracker_counter_state DROP CONSTRAINT IF EXISTS tracker_counter_state_device_assignment_id_fkey;
ALTER TABLE tracker_counter_state ADD CONSTRAINT tracker_counter_state_device_assignment_id_fkey
  FOREIGN KEY (device_assignment_id) REFERENCES device_assignments(id) ON DELETE SET NULL;
ALTER TABLE mileage_reading_events DROP CONSTRAINT IF EXISTS mileage_reading_events_vehicle_id_fkey;
ALTER TABLE mileage_reading_events ADD CONSTRAINT mileage_reading_events_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE mileage_reading_events DROP CONSTRAINT IF EXISTS mileage_reading_events_company_id_fkey;
ALTER TABLE mileage_reading_events ADD CONSTRAINT mileage_reading_events_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

COMMIT;

-- NUMZFLEET vehicle-owned odometer.
--
-- Until now the verified-odometer anchor lived in vehicle_specs, keyed by the Traccar DEVICE id
-- (vehicle_specs."deviceId" is unique). A tracker is replaceable hardware; the vehicle is the asset
-- whose mileage must survive. Replacing a tracker therefore collapsed the vehicle's odometer to the
-- new tracker's own counter, and moving a tracker between vehicles carried the first vehicle's
-- anchor to the second.
--
-- This migration is ADDITIVE ONLY:
--   * vehicle_odometer_anchors  the vehicle's accepted mileage baseline AND its audit history
--                               (append-only; exactly one current row per vehicle)
--   * vehicle_mileage_gaps      intervals of unobserved distance (tracker replaced, tracker removed)
--   * vehicle_tracker_changes   one row per tracker change: what was carried forward and whether the
--                               vehicle's maintenance schedules were re-linked to the new tracker
--   * unique indexes making a double-active tracker assignment impossible (skipped, with a NOTICE,
--     if the data already contains duplicates, so a deploy never aborts on historical dirt)
--   * a backfill of legacy anchors, with explicit handling of ambiguous mappings.
-- Nothing in vehicle_specs / device_assignments is modified, so the previous release keeps working
-- against the same database, and the original evidence is preserved byte for byte.
--
-- Legacy backfill rules (a device-keyed anchor is NOT blindly copied to a vehicle):
--   unambiguous  the anchor has a timestamp; the vehicle held the tracker when it was captured; and no
--                OTHER vehicle held that tracker at or after that moment (its counter ran only on this
--                vehicle). Becomes the vehicle's current anchor, state 'legacy_unverified' -- never
--                relabelled 'physically_verified', because legacy rows cannot say whether a human read
--                the dashboard or accepted the system's own estimate.
--   ambiguous    anything else (no timestamp, predates the assignment, the tracker was on another
--                vehicle since, duplicate active assignments). Kept as superseded history attributed to
--                the vehicle that held the tracker at that time, with the reason; it never becomes a
--                current anchor, so no vehicle inherits another vehicle's mileage.
-- Legacy tracker readings stored in metres (>= 500,000) are converted to km exactly like
-- legacyAnchorTelemetryToKm() in normaliseEvidence.js; the raw value is kept in evidence.
--
-- Recovery: migrations-rollback/20261016_vehicle_owned_odometer.down.sql renames the new tables aside
-- (nothing is dropped) and removes the guard indexes. See docs/VEHICLE_OWNED_ODOMETER.md.

BEGIN;

CREATE TABLE IF NOT EXISTS vehicle_odometer_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Traccar device whose counter telemetry_km refers to. NULL when no tracker is involved.
  device_id INTEGER,
  -- The assignment period that counter belongs to: counter history is only meaningful inside it.
  device_assignment_id UUID REFERENCES device_assignments(id) ON DELETE SET NULL,
  -- The accepted vehicle odometer at observed_at.
  odometer_km DOUBLE PRECISION NOT NULL,
  -- The tracker counter (km) at that same moment. NULL = the baseline is not established yet
  -- (the tracker has not reported since this anchor was set).
  telemetry_km DOUBLE PRECISION,
  telemetry_at TIMESTAMPTZ,
  -- Audit: what the vehicle's accepted odometer was immediately before this change.
  previous_odometer_km DOUBLE PRECISION,
  previous_anchor_id UUID,
  kind VARCHAR(32) NOT NULL,
  state VARCHAR(32) NOT NULL,
  source VARCHAR(32),
  reason TEXT,
  -- Traccar user id of the person responsible; NULL for system-made changes.
  actor_user_id INTEGER,
  observed_at TIMESTAMPTZ NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  superseded_at TIMESTAMPTZ,
  superseded_by_anchor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_odometer_anchors_odometer_nonneg CHECK (odometer_km >= 0),
  CONSTRAINT vehicle_odometer_anchors_kind_check CHECK (kind IN (
    'observation', 'tracker_replacement', 'tracker_removal', 'assignment_start', 'legacy_migration',
    'reset_reconciliation', 'correction')),
  CONSTRAINT vehicle_odometer_anchors_state_check CHECK (state IN (
    'physically_verified', 'trusted_estimate', 'provisional', 'awaiting_tracker', 'legacy_unverified'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_vehicle_odometer_anchors_current
  ON vehicle_odometer_anchors (vehicle_id) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_anchors_history
  ON vehicle_odometer_anchors (vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_odometer_anchors_device
  ON vehicle_odometer_anchors (device_id);

CREATE TABLE IF NOT EXISTS vehicle_mileage_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind VARCHAR(32) NOT NULL,
  from_device_id INTEGER,
  to_device_id INTEGER,
  -- Last accepted evidence before the gap, and the first valid evidence after it.
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  -- The accepted odometer when the gap opened. The distance driven inside the gap is UNKNOWN:
  -- it is never estimated or filled in.
  last_odometer_km DOUBLE PRECISION,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  resolved_by_anchor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_mileage_gaps_kind_check CHECK (kind IN (
    'tracker_replacement', 'no_tracker', 'tracker_offline', 'counter_reset')),
  CONSTRAINT vehicle_mileage_gaps_status_check CHECK (status IN ('open', 'closed_unobserved', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_vehicle_mileage_gaps_vehicle
  ON vehicle_mileage_gaps (vehicle_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_mileage_gaps_open
  ON vehicle_mileage_gaps (vehicle_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS vehicle_tracker_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_device_id INTEGER,
  to_device_id INTEGER,
  from_assignment_id UUID,
  to_assignment_id UUID,
  anchor_id UUID,
  gap_id UUID,
  -- The vehicle's accepted odometer that was carried onto the new tracker.
  carried_odometer_km DOUBLE PRECISION,
  changed_at TIMESTAMPTZ NOT NULL,
  actor_user_id INTEGER,
  -- Maintenance schedules live in Traccar, attached to a device. They follow the vehicle:
  -- this records whether they were re-linked to the new tracker, so a failure can be retried.
  maintenance_relink_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  maintenance_relink_error TEXT,
  maintenance_moved JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_tracker_changes_relink_check CHECK (maintenance_relink_status IN (
    'pending', 'synced', 'failed', 'not_applicable'))
);

CREATE INDEX IF NOT EXISTS idx_vehicle_tracker_changes_vehicle
  ON vehicle_tracker_changes (vehicle_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_tracker_changes_relink
  ON vehicle_tracker_changes (maintenance_relink_status) WHERE maintenance_relink_status IN ('pending', 'failed');

-- Sequelize's sync() at boot can create these tables from the model files before this migration
-- runs (documented race -- see 20260731_roles_permissions_foundation.sql), in which case the
-- CREATE TABLE IF NOT EXISTS above is skipped. Re-state the foreign keys so the end state is the
-- same whichever path created the tables first.
ALTER TABLE vehicle_odometer_anchors DROP CONSTRAINT IF EXISTS vehicle_odometer_anchors_vehicle_id_fkey;
ALTER TABLE vehicle_odometer_anchors ADD CONSTRAINT vehicle_odometer_anchors_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE vehicle_odometer_anchors DROP CONSTRAINT IF EXISTS vehicle_odometer_anchors_company_id_fkey;
ALTER TABLE vehicle_odometer_anchors ADD CONSTRAINT vehicle_odometer_anchors_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE vehicle_odometer_anchors DROP CONSTRAINT IF EXISTS vehicle_odometer_anchors_device_assignment_id_fkey;
ALTER TABLE vehicle_odometer_anchors ADD CONSTRAINT vehicle_odometer_anchors_device_assignment_id_fkey
  FOREIGN KEY (device_assignment_id) REFERENCES device_assignments(id) ON DELETE SET NULL;
ALTER TABLE vehicle_mileage_gaps DROP CONSTRAINT IF EXISTS vehicle_mileage_gaps_vehicle_id_fkey;
ALTER TABLE vehicle_mileage_gaps ADD CONSTRAINT vehicle_mileage_gaps_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE vehicle_mileage_gaps DROP CONSTRAINT IF EXISTS vehicle_mileage_gaps_company_id_fkey;
ALTER TABLE vehicle_mileage_gaps ADD CONSTRAINT vehicle_mileage_gaps_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE vehicle_tracker_changes DROP CONSTRAINT IF EXISTS vehicle_tracker_changes_vehicle_id_fkey;
ALTER TABLE vehicle_tracker_changes ADD CONSTRAINT vehicle_tracker_changes_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE vehicle_tracker_changes DROP CONSTRAINT IF EXISTS vehicle_tracker_changes_company_id_fkey;
ALTER TABLE vehicle_tracker_changes ADD CONSTRAINT vehicle_tracker_changes_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- One active assignment per vehicle and per physical tracker. The application already serialises
-- assignments; this makes a violation impossible rather than merely unlikely. Skipped with a NOTICE
-- when historical duplicates exist: reconcile them, then re-run the migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM device_assignments WHERE "isActive" = true GROUP BY "vehicleId" HAVING COUNT(*) > 1) THEN
    RAISE NOTICE '[vehicle_owned_odometer] skipped device_assignments_active_vehicle_unique: a vehicle has several active assignments';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS device_assignments_active_vehicle_unique
      ON device_assignments ("vehicleId") WHERE "isActive" = true;
  END IF;

  IF EXISTS (SELECT 1 FROM device_assignments WHERE "isActive" = true GROUP BY "deviceId" HAVING COUNT(*) > 1) THEN
    RAISE NOTICE '[vehicle_owned_odometer] skipped device_assignments_active_device_unique: a tracker has several active assignments';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS device_assignments_active_device_unique
      ON device_assignments ("deviceId") WHERE "isActive" = true;
  END IF;
END $$;

-- Legacy backfill (see the rules in the header). Idempotent: a legacy spec is migrated at most once,
-- and a legacy anchor never becomes current when the vehicle already has a current anchor.
WITH candidates AS (
  SELECT
    s.id AS spec_id,
    s."deviceId" AS device_id,
    s."verifiedOdometerKm" AS odometer_km,
    s."verifiedOdometerAt" AS verified_at,
    s."verifiedOdometerSource" AS src,
    s."verifiedTraccarDistance" AS raw_tracker,
    a.id AS assignment_id,
    a."vehicleId" AS vehicle_id,
    v.company_id AS company_id
  FROM vehicle_specs s
  JOIN device_assignments a ON a."deviceId" = s."deviceId" AND a."isActive" = true
  JOIN vehicles v ON v.id = a."vehicleId"
  WHERE s."verifiedOdometerKm" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM vehicle_odometer_anchors done
      WHERE done.kind = 'legacy_migration' AND done.evidence #>> '{legacy,specId}' = s.id::text)
),
classified AS (
  SELECT
    c.*,
    (
      c.verified_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM device_assignments m
        WHERE m."deviceId" = c.device_id AND m."vehicleId" = c.vehicle_id
          AND m."assignedAt" <= c.verified_at AND COALESCE(m."unassignedAt", NOW()) >= c.verified_at)
      AND NOT EXISTS (
        SELECT 1 FROM device_assignments o
        WHERE o."deviceId" = c.device_id AND o."vehicleId" <> c.vehicle_id
          AND COALESCE(o."unassignedAt", NOW()) >= c.verified_at)
    ) AS unambiguous,
    -- who held the tracker when the anchor was captured (NULL when nobody provably did)
    (
      SELECT m."vehicleId" FROM device_assignments m
      WHERE c.verified_at IS NOT NULL AND m."deviceId" = c.device_id
        AND m."assignedAt" <= c.verified_at AND COALESCE(m."unassignedAt", NOW()) >= c.verified_at
      ORDER BY m."assignedAt" DESC LIMIT 1
    ) AS holder_vehicle_id
  FROM candidates c
),
ranked AS (
  SELECT
    x.*,
    ROW_NUMBER() OVER (PARTITION BY x.vehicle_id, x.unambiguous ORDER BY x.verified_at DESC NULLS LAST, x.spec_id) AS rn
  FROM classified x
),
decided AS (
  SELECT
    r.*,
    (r.unambiguous AND r.rn = 1
      AND NOT EXISTS (
        SELECT 1 FROM vehicle_odometer_anchors cur
        WHERE cur.vehicle_id = r.vehicle_id AND cur.superseded_at IS NULL)) AS as_current,
    CASE
      WHEN r.unambiguous AND r.rn > 1 THEN 'another active assignment of this vehicle holds a newer anchor'
      WHEN r.unambiguous THEN 'the vehicle already has a current anchor'
      WHEN r.verified_at IS NULL THEN 'the anchor has no timestamp, so it cannot be placed on any assignment'
      WHEN r.holder_vehicle_id IS NULL THEN 'the anchor predates the current assignment (the tracker was not on this vehicle when it was captured)'
      WHEN r.holder_vehicle_id <> r.vehicle_id THEN 'the anchor was captured while another vehicle held the tracker'
      ELSE 'the tracker ran on another vehicle after the anchor was captured, so its counter delta is not this vehicle''s distance'
    END AS quarantine_reason
  FROM ranked r
)
INSERT INTO vehicle_odometer_anchors (
  vehicle_id, company_id, device_id, device_assignment_id, odometer_km, telemetry_km,
  kind, state, source, reason, observed_at, evidence, superseded_at
)
SELECT
  COALESCE(d.holder_vehicle_id, d.vehicle_id),
  COALESCE((SELECT vv.company_id FROM vehicles vv WHERE vv.id = COALESCE(d.holder_vehicle_id, d.vehicle_id)), d.company_id),
  d.device_id,
  CASE WHEN d.as_current THEN d.assignment_id END,
  d.odometer_km,
  CASE
    WHEN d.raw_tracker IS NULL THEN NULL
    WHEN d.raw_tracker >= 500000 THEN ROUND((d.raw_tracker / 1000)::numeric, 1)::double precision
    ELSE ROUND(d.raw_tracker::numeric, 1)::double precision
  END,
  'legacy_migration',
  'legacy_unverified',
  COALESCE(d.src, 'legacy'),
  CASE WHEN d.as_current THEN NULL ELSE 'quarantined: ' || d.quarantine_reason END,
  COALESCE(d.verified_at, NOW()),
  jsonb_build_object(
    'legacy', jsonb_build_object(
      'specId', d.spec_id,
      'deviceId', d.device_id,
      'verifiedOdometerKm', d.odometer_km,
      'verifiedOdometerAt', d.verified_at,
      'verifiedOdometerSource', d.src,
      'verifiedTraccarDistance', d.raw_tracker),
    'classification', CASE WHEN d.unambiguous THEN 'unambiguous' ELSE 'ambiguous' END,
    'quarantineReason', CASE WHEN d.as_current THEN NULL ELSE d.quarantine_reason END
  ),
  CASE WHEN d.as_current THEN NULL ELSE NOW() END
FROM decided d
-- a quarantined row is attributed to the vehicle that held the tracker at the time; it must not
-- collide with that vehicle's own current anchor
ORDER BY d.spec_id;

COMMIT;

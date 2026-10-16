-- Recovery for 20261016_vehicle_owned_odometer.sql. NOT part of MIGRATION_ORDER: run it by hand,
-- deliberately, after taking a backup.
--
-- Nothing is dropped. The three new tables (and their indexes) are renamed aside with a timestamp
-- suffix, so the audit history recorded since the migration is kept and can be inspected or
-- re-attached, and the original names are free again. The guard indexes on device_assignments are
-- removed. vehicle_specs and device_assignments data are never touched by the forward migration, so
-- there is nothing to restore there: the previous release resumes from exactly the evidence it had.
--
-- NOTE: while the new release ran, anchor changes were mirrored into vehicle_specs for the vehicle's
-- current tracker, so the previous release sees the latest accepted baseline, not a stale one.

BEGIN;

DO $$
DECLARE
  ts TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
  t TEXT;
  i RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicle_odometer_anchors', 'vehicle_mileage_gaps', 'vehicle_tracker_changes'] LOOP
    IF to_regclass(t) IS NULL THEN CONTINUE; END IF;
    FOR i IN SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = t LOOP
      EXECUTE format('ALTER INDEX %I RENAME TO %I', i.indexname, left(i.indexname, 40) || '_rb' || ts);
    END LOOP;
    EXECUTE format('ALTER TABLE %I RENAME TO %I', t, t || '_rolledback_' || ts);
  END LOOP;
END $$;

DROP INDEX IF EXISTS device_assignments_active_vehicle_unique;
DROP INDEX IF EXISTS device_assignments_active_device_unique;

COMMIT;

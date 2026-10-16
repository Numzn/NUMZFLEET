-- Recovery for 20261017_accepted_mileage_readings.sql. NOT part of MIGRATION_ORDER: run by hand, deliberately,
-- after taking a backup.
--
-- Nothing is dropped. The two new tables (and their indexes) are renamed aside with a timestamp suffix so the
-- decisions recorded since the migration can still be inspected. The columns added to vehicle_daily_mileage
-- are LEFT IN PLACE: the previous release ignores them, and every figure it wrote (distanceKm etc.) was never
-- touched by the forward migration. Rows written by the accepted-readings method keep their confirmedKm /
-- unattributedKm; the previous release will simply recompute distanceKm itself as it always did.

BEGIN;

DO $$
DECLARE
  ts TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
  t TEXT;
  i RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['tracker_counter_state', 'mileage_reading_events'] LOOP
    IF to_regclass(t) IS NULL THEN CONTINUE; END IF;
    FOR i IN SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = t LOOP
      EXECUTE format('ALTER INDEX %I RENAME TO %I', i.indexname, left(i.indexname, 40) || '_rb' || ts);
    END LOOP;
    EXECUTE format('ALTER TABLE %I RENAME TO %I', t, t || '_rolledback_' || ts);
  END LOOP;
END $$;

COMMIT;

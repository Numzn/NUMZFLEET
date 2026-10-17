-- Recovery for 20261018_place_boundaries.sql. NOT part of MIGRATION_ORDER: run by hand after a backup.
--
-- The catalogue is reference data that can be rebuilt at any time by re-running the importer, and nothing else
-- references it, so rolling back is safe. The table is renamed aside (not dropped) with a timestamp suffix; the
-- previous release never reads it. Geofences already saved from it live in Traccar and are unaffected.

BEGIN;

DO $$
DECLARE
  ts TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
  i RECORD;
BEGIN
  IF to_regclass('place_boundaries') IS NULL THEN RETURN; END IF;
  FOR i IN SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'place_boundaries' LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I', i.indexname, i.indexname || '_old_' || ts);
  END LOOP;
  ALTER TABLE place_boundaries DROP CONSTRAINT IF EXISTS place_boundaries_source_unique;
  EXECUTE format('ALTER TABLE place_boundaries RENAME TO %I', 'place_boundaries_old_' || ts);
END $$;

COMMIT;

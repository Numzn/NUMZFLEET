-- Corrective migration: add the company_id foreign keys that Sequelize's
-- development autosync could not create.
--
-- Why this exists: in development, sequelize.sync() creates tables from the
-- models as soon as nodemon reloads. It got to notification_deliveries and
-- notification_delivery_attempts before 20260903_notification_deliveries.sql
-- was applied, so that migration's CREATE TABLE ... IF NOT EXISTS correctly
-- skipped — taking its inline REFERENCES companies(id) with it. The columns and
-- indexes are right; only the two tenant foreign keys were missing.
--
-- The models deliberately declare company_id as a plain UUID column (matching
-- notifications.company_id, which is also plain), so autosync will never add
-- these on its own. This migration is the only place they come from.
--
-- Same shape as 20260901_fix_push_subscriptions_unique_endpoint.sql, which
-- exists for exactly the same autosync reason.
--
-- Idempotent; safe to re-run.
-- Reverse:
--   ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_company_id_fkey;
--   ALTER TABLE notification_delivery_attempts DROP CONSTRAINT IF EXISTS notification_delivery_attempts_company_id_fkey;
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_deliveries_company_id_fkey'
  ) THEN
    ALTER TABLE notification_deliveries
      ADD CONSTRAINT notification_deliveries_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_delivery_attempts_company_id_fkey'
  ) THEN
    ALTER TABLE notification_delivery_attempts
      ADD CONSTRAINT notification_delivery_attempts_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

COMMIT;

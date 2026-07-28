-- Corrective migration: Sequelize's sync() (models/index.js syncDatabase(),
-- run on every server boot) created notification_preferences and
-- login_audit_events *before* their own CREATE-TABLE migrations ever ran this
-- session, since sync() races ahead of a manually-triggered migration script
-- in dev. sync() doesn't carry ON DELETE options from field-level
-- `references`/`onDelete` (those were added to the models after the fact) or
-- from models/index.js association options into actual DDL, so the live
-- constraints ended up wrong: notification_preferences.numz_user_id had a
-- bare FK with no ON DELETE CASCADE, and login_audit_events.company_id had no
-- FK constraint at all. This fixes both regardless of which shape they're
-- currently in. Idempotent; safe to re-run.
BEGIN;

ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_numz_user_id_fkey;
ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_numz_user_id_fkey
  FOREIGN KEY (numz_user_id) REFERENCES numz_users(id) ON DELETE CASCADE;

ALTER TABLE login_audit_events DROP CONSTRAINT IF EXISTS login_audit_events_company_id_fkey;
ALTER TABLE login_audit_events
  ADD CONSTRAINT login_audit_events_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

COMMIT;

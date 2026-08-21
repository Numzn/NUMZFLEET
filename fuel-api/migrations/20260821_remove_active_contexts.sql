-- Remove active_contexts table (unused — the cross-company context-switching
-- feature it backed was fully reversed to a one-org-per-session model; the
-- Sequelize model, service functions, routes, and frontend switcher that
-- ever read/wrote this table were all removed in the same cleanup).
-- Idempotent; safe to re-run.
-- ALLOW-DESTRUCTIVE: active_contexts is unused — context switching was reversed and the table has had zero readers/writers since; verified before merge.

BEGIN;

DROP TABLE IF EXISTS active_contexts CASCADE;

COMMIT;

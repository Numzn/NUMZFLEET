-- Remove company_relationships table (unused — sole source of truth is companies.parent_company_id)
-- Idempotent; safe to re-run.

BEGIN;

DROP TABLE IF EXISTS company_relationships CASCADE;

COMMIT;

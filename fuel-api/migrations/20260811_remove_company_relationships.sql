-- Remove company_relationships table (unused — sole source of truth is companies.parent_company_id)
-- Idempotent; safe to re-run.
-- ALLOW-DESTRUCTIVE: company_relationships is unused — companies.parent_company_id is the sole source of truth; verified before merge.

BEGIN;

DROP TABLE IF EXISTS company_relationships CASCADE;

COMMIT;

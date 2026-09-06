-- Code-review fix: push_subscriptions was created (2026-09-01) after
-- docs/PLATFORM_ARCHITECTURE.md's Data isolation rule #1 existed ("Every
-- new business table: company_id NOT NULL + FK — non-negotiable in code
-- review") but never got a company_id column. Not an active cross-tenant
-- leak today (every read/write is scoped by numz_user_id, which itself
-- belongs to one company) — this closes the schema gap so the table
-- matches the same rule its sibling notification_deliveries/
-- notification_delivery_attempts tables (20260903) already follow.
--
-- Backfilled from the owning numz_user's own company_id, falling back to
-- DEFAULT_COMPANY_ID for the (currently nonexistent, per audit) case of a
-- platform-only numz_user with no home company — same convention used
-- throughout this codebase's tenancy backfills.
--
-- Idempotent; safe to re-run.
-- Reverse:
--   ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_company_id_fkey;
--   ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS company_id;
BEGIN;

ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS company_id UUID;

UPDATE push_subscriptions ps
SET company_id = COALESCE(
  (SELECT u.company_id FROM numz_users u WHERE u.id = ps.numz_user_id),
  '00000000-0000-0000-0000-000000000001'
)
WHERE company_id IS NULL;

ALTER TABLE push_subscriptions ALTER COLUMN company_id SET NOT NULL;

-- Plain UUID column, no inline REFERENCES — matching notification_deliveries'
-- own note: Sequelize dev autosync can create this table from the model
-- before this migration runs, and an inline FK on the model would make
-- autosync race ahead without it. This migration is the sole source of the FK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_company_id_fkey'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_company_id ON push_subscriptions (company_id);

COMMIT;

-- RBAC foundation: data-driven roles/permissions layer, additive only.
-- Nothing in the application reads these tables yet — this is Stage 1 of
-- the migration strategy in the roles/permissions architecture proposal:
-- create the shape, leave every existing authorization path untouched.
--
-- Supersedes numz_user_roles in spirit (that table has 0 rows and zero code
-- references — see the Permissions/Roles/Organization audit) with a richer
-- model: role_permissions expresses a role as a bundle of permissions, and
-- user_roles assigns a role to a user *within a specific company* (or with
-- company_id NULL, at the platform level, for a Platform Super Admin).
-- numz_user_roles itself is left in place for now — dropping it is a later,
-- separate step once this new path is proven and nothing could regress.

BEGIN;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL company_id = a system role template shared by every tenant
  -- (Company Admin, Fleet Manager, ...). Non-null = a company's own
  -- custom role, once that feature exists (see the domain-model discussion
  -- on why custom-role *building* is deliberately out of scope for now).
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  key VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- company_id is nullable, so a single UNIQUE(company_id, key) constraint
-- would silently allow duplicate system-role rows (Postgres treats NULLs as
-- distinct in a plain unique constraint). Two partial indexes instead:
-- one key per system-template role, one key per company for custom roles.
CREATE UNIQUE INDEX IF NOT EXISTS roles_system_key_unique
  ON roles (key) WHERE company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS roles_company_key_unique
  ON roles (company_id, key) WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Namespaced string, e.g. 'fleet.vehicles.manage' — matches the shape
  -- already used in docs/PLATFORM_ARCHITECTURE.md's own ExecutionContext
  -- examples ('platform.companies.manage', 'vehicles.read', 'fuel.approve').
  key VARCHAR(128) NOT NULL UNIQUE,
  category VARCHAR(64) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numz_user_id UUID NOT NULL REFERENCES numz_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  -- Nullable for the same reason as roles.company_id: a Platform Super
  -- Admin's role assignment has no company. Two partial unique indexes
  -- below prevent duplicate assignments in either case.
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_company_unique
  ON user_roles (numz_user_id, role_id, company_id) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_platform_unique
  ON user_roles (numz_user_id, role_id) WHERE company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_roles_company_id ON roles (company_id);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions (category);
CREATE INDEX IF NOT EXISTS idx_user_roles_numz_user_id ON user_roles (numz_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON user_roles (company_id);

-- fuel-api's Sequelize sync() at boot can create these tables from the model
-- files before this migration ever runs (a known race — see the Settings
-- Center session's earlier FK incident). When that happens, the CREATE TABLE
-- IF NOT EXISTS above is skipped entirely, so its ON DELETE CASCADE clauses
-- never take effect and every FK silently defaults to NO ACTION. Drop and
-- re-add each FK unconditionally so the final state is correct regardless of
-- which path created the table — safe to re-run either way.
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_company_id_fkey;
ALTER TABLE roles ADD CONSTRAINT roles_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_fkey
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_permission_id_fkey;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_permission_id_fkey
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_numz_user_id_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_numz_user_id_fkey
  FOREIGN KEY (numz_user_id) REFERENCES numz_users(id) ON DELETE CASCADE;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_id_fkey
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_company_id_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

COMMIT;

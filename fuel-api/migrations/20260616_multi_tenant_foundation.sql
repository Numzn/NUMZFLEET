-- Multi-tenant foundation: companies, numz users, company_id on business tables.
-- Idempotent; safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  traccar_group_id INTEGER NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO companies (id, slug, name, status, settings, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Default Fleet',
  'active',
  '{}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM (
    'super_admin',
    'company_admin',
    'fleet_manager',
    'dispatcher',
    'driver',
    'technician'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS numz_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  display_name VARCHAR(255) NOT NULL DEFAULT '',
  traccar_user_id INTEGER UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT numz_users_company_email_unique UNIQUE (company_id, email)
);

CREATE TABLE IF NOT EXISTS numz_user_roles (
  user_id UUID NOT NULL REFERENCES numz_users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS company_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  traccar_device_id INTEGER NOT NULL,
  vehicle_id UUID NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, traccar_device_id),
  UNIQUE (traccar_device_id)
);

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE vehicles SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

ALTER TABLE fuel_requests ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE fuel_requests SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

ALTER TABLE operation_sessions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE operation_sessions SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

ALTER TABLE operation_session_refuels ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE operation_session_refuels SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

ALTER TABLE vehicle_immobilization_intents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE vehicle_immobilization_intents SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'tenant_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN tenant_id TO company_id;
  END IF;
END $$;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
UPDATE notifications SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON vehicles (company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_requests_company_id ON fuel_requests (company_id);
CREATE INDEX IF NOT EXISTS idx_operation_sessions_company_id ON operation_sessions (company_id);
CREATE INDEX IF NOT EXISTS idx_operation_session_refuels_company_id ON operation_session_refuels (company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications (company_id);

COMMIT;

-- NUMZFLEET Driver domain: a company-scoped, NUMZFLEET-owned driver record.
--
-- Until now "driver" existed only as a Traccar object (tc_drivers) with no
-- company column at all — architecturally impossible to check ownership
-- against (see the Driver ↔ Person/User ↔ Vehicle tenancy audit). This
-- migration adds the missing record. Traccar's own tc_drivers/tc_user_driver/
-- tc_device_driver rows are left untouched and continue to exist as an
-- integration projection — this migration does not delete or alter anything
-- in Traccar.
--
-- drivers.traccar_driver_id is an integration reference only, never the
-- business identity (drivers.id, a NUMZFLEET UUID, is) — the same shape as
-- numz_users.traccar_user_id.
--
-- driver_assignments mirrors device_assignments' own shape deliberately
-- (vehicle_id + assigned_at/unassigned_at/is_active, history preserved by
-- inserting a new row rather than overwriting driver_id in place) — this is
-- the NUMZFLEET Driver ↔ Vehicle relationship; it does not reference
-- Traccar's device id at all. History is kept for the driver's lifetime
-- (RESTRICT on vehicle_id — a vehicle can't vanish out from under recorded
-- history), but CASCADEs away with the driver itself (driver_id) — once the
-- driver record is gone there is nothing left to join that history back to,
-- matching the pre-existing UI's own documented delete behavior ("drops its
-- vehicle association... leaves no record"). The corresponding Traccar
-- device ↔ driver link (tc_device_driver) is a synchronized projection,
-- maintained by the service layer, not read back from here.

BEGIN;

CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Optional: a driver profile does not require a NUMZFLEET sign-in account,
  -- same as Traccar drivers never required a Traccar user today.
  numz_user_id UUID REFERENCES numz_users(id) ON DELETE SET NULL,
  -- Integration reference only. Nullable so a driver record can still exist
  -- (unavailable to normal operation) if Traccar projection ever fails softly
  -- on backfill — never used to look up a driver for a tenancy decision.
  traccar_driver_id INTEGER,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  -- The physical tag/key a vehicle's telemetry reports back as
  -- position.attributes.driverUniqueId — this is what actually identifies a
  -- driver to the fleet, unrelated to company scope, so it stays globally
  -- unique the same way Traccar's own tc_drivers.uniqueid is.
  unique_id VARCHAR(128) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS drivers_unique_id_unique ON drivers (unique_id);
CREATE UNIQUE INDEX IF NOT EXISTS drivers_traccar_driver_id_unique
  ON drivers (traccar_driver_id) WHERE traccar_driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON drivers (company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_numz_user_id ON drivers (numz_user_id);

CREATE TABLE IF NOT EXISTS driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active driver per vehicle at a time — "Change driver" replaces the
-- assignment (deactivate + insert new row), it never updates driver_id in
-- place, so history survives. Mirrors device_assignments' own pattern.
CREATE UNIQUE INDEX IF NOT EXISTS driver_assignments_active_vehicle_unique
  ON driver_assignments (vehicle_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_driver_assignments_vehicle_id ON driver_assignments (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_driver_id ON driver_assignments (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_is_active ON driver_assignments (is_active);

-- Sequelize's sync() at boot can create these tables from the model files
-- before this migration ever runs (documented race — see
-- 20260731_roles_permissions_foundation.sql). When that happens the CREATE
-- TABLE IF NOT EXISTS above is skipped, so its FK clauses never take effect.
-- Drop and re-add each FK unconditionally so the final state is correct
-- regardless of which path created the table first — safe to re-run either
-- way.
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_company_id_fkey;
ALTER TABLE drivers ADD CONSTRAINT drivers_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_numz_user_id_fkey;
ALTER TABLE drivers ADD CONSTRAINT drivers_numz_user_id_fkey
  FOREIGN KEY (numz_user_id) REFERENCES numz_users(id) ON DELETE SET NULL;

ALTER TABLE driver_assignments DROP CONSTRAINT IF EXISTS driver_assignments_vehicle_id_fkey;
ALTER TABLE driver_assignments ADD CONSTRAINT driver_assignments_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT;

ALTER TABLE driver_assignments DROP CONSTRAINT IF EXISTS driver_assignments_driver_id_fkey;
ALTER TABLE driver_assignments ADD CONSTRAINT driver_assignments_driver_id_fkey
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;

COMMIT;

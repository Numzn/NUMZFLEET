-- Vehicle Visibility Audit (D5): vehicles.company_id has allowed NULL since
-- the original tenant-foundation migration, and two tenancy checks
-- (assertVehicleInTenant, listDeviceAssignments) silently skip their
-- ownership comparison whenever it's NULL — a vehicle with no company would
-- pass the check for any caller. Backfill any such rows to the default
-- tenant (same target the original migration used for its own backfill),
-- then make the column mandatory going forward.
--
-- Idempotent: the UPDATE only touches rows that are still NULL, and
-- SET NOT NULL is a no-op if the column is already NOT NULL.

UPDATE vehicles
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

ALTER TABLE vehicles
  ALTER COLUMN company_id SET NOT NULL;

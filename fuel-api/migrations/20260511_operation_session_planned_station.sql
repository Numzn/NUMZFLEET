-- Planned litres per refuel line + optional fuel station on session.
BEGIN;

ALTER TABLE operation_sessions
  ADD COLUMN IF NOT EXISTS "fuelStationId" INTEGER,
  ADD COLUMN IF NOT EXISTS "stationName" VARCHAR(120);

ALTER TABLE operation_session_refuels
  ADD COLUMN IF NOT EXISTS "plannedFuelLitres" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS operation_sessions_fuel_station_id ON operation_sessions ("fuelStationId");

COMMIT;

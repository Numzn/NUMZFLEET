-- Add 'incomplete' to refuel row status enum (operations control panel — placeholder rows).
BEGIN;

ALTER TYPE enum_operation_session_refuels_status ADD VALUE IF NOT EXISTS 'incomplete';

COMMIT;

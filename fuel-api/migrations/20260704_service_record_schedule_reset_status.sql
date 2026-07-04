-- Durable, visible outcome of the Traccar maintenance-schedule rebase that
-- happens on service-record completion. Previously this was a client-side
-- thrown error only — invisible if the browser disconnected mid-completion.

BEGIN;

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "scheduleResetStatus" VARCHAR(16) NOT NULL DEFAULT 'not_applicable';

ALTER TABLE service_records
  ADD COLUMN IF NOT EXISTS "scheduleResetError" TEXT;

COMMIT;

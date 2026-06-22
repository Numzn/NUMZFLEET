-- Smart Invoice attachments: store a link to the captured invoice file.
-- Litres/cost remain nullable until auto-extraction is implemented.

BEGIN;

ALTER TABLE operation_session_invoices
  ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;

COMMIT;

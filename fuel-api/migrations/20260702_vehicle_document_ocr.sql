-- Vehicle document OCR extraction storage (Python extracts raw text; Node owns facts).

BEGIN;

ALTER TABLE vehicle_documents
  ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(16),
  ADD COLUMN IF NOT EXISTS ocr_raw_text TEXT,
  ADD COLUMN IF NOT EXISTS ocr_facts JSONB,
  ADD COLUMN IF NOT EXISTS ocr_processed_at TIMESTAMPTZ;

COMMIT;

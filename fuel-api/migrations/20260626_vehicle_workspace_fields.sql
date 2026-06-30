-- Vehicle workspace fields: notes, identity, photo, home base, documents.

BEGIN;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS make VARCHAR(80);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model VARCHAR(80);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_file_id VARCHAR(64);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS home_base_label VARCHAR(120);

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id SERIAL PRIMARY KEY,
  company_id UUID NOT NULL,
  fleet_vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'other',
  file_id VARCHAR(64) NOT NULL,
  uploaded_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_company_vehicle
  ON vehicle_documents (company_id, fleet_vehicle_id);

COMMIT;

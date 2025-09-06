-- Migration: Add model field to vehicles table
-- This field is required by the vehicle registration form but missing from the database

-- Add model field to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model VARCHAR(100);

-- Update existing vehicles to have a default model if they don't have one
UPDATE vehicles SET model = 'Unknown' WHERE model IS NULL;

-- Make model field NOT NULL after setting default values
ALTER TABLE vehicles ALTER COLUMN model SET NOT NULL;

-- Add index for better performance on model searches
CREATE INDEX IF NOT EXISTS idx_vehicles_model ON vehicles(model);

-- Log the migration
INSERT INTO system_config (key, value) VALUES 
('migration_001', 'Added model field to vehicles table')
ON CONFLICT (key) DO UPDATE SET value = 'Added model field to vehicles table', updated_at = NOW();

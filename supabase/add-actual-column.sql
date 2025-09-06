-- Migration: Add actual column to vehicles table
-- This field tracks actual fuel spending vs. budget

-- Add actual field to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS actual DECIMAL(12,2) DEFAULT 0;

-- Update existing vehicles to have actual = 0 if they don't have one
UPDATE vehicles SET actual = 0 WHERE actual IS NULL;

-- Log the migration
INSERT INTO system_config (key, value) VALUES 
('migration_002', 'Added actual column to vehicles table')
ON CONFLICT (key) DO UPDATE SET value = 'Added actual column to vehicles table', updated_at = NOW();

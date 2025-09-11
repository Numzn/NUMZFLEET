-- Database Migration Script
-- Fix missing 'model' column in vehicles table

-- Add the missing 'model' column to the vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model VARCHAR;

-- Update existing records to have a default model value if needed
UPDATE vehicles SET model = 'Unknown' WHERE model IS NULL;

-- Add a comment to the column for documentation
COMMENT ON COLUMN vehicles.model IS 'Vehicle model (e.g., 2012, Camry, etc.)';

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
ORDER BY ordinal_position;

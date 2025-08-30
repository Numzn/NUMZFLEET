-- Fix Admin Table Foreign Key Constraint
-- Migration: 005_fix_admin_table.sql

-- Drop the existing admins table with foreign key constraint
DROP TABLE IF EXISTS admins CASCADE;

-- Recreate admins table without foreign key constraint to auth.users
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- For local authentication
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'owner')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate the index
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);

-- Recreate the trigger
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a default admin user
INSERT INTO admins (email, role, is_active) VALUES 
('admin@numzfleet.com', 'owner', true),
('numerinyirenda14gmail.com', 'admin', true)
ON CONFLICT (email) DO NOTHING;

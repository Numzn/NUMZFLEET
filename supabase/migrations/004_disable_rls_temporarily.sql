-- Temporarily disable RLS to fix infinite recursion
-- Migration: 004_disable_rls_temporarily.sql

-- Disable RLS on all tables temporarily
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_config DISABLE ROW LEVEL SECURITY;

-- This will allow the app to work while we fix the RLS policies
-- We can re-enable them later with proper policies

-- Fix RLS Policies to prevent infinite recursion
-- Migration: 003_fix_rls_policies.sql

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all admin records" ON admins;
DROP POLICY IF EXISTS "Admins can insert admin records" ON admins;
DROP POLICY IF EXISTS "Admins can update admin records" ON admins;
DROP POLICY IF EXISTS "Owners can delete admin records" ON admins;

DROP POLICY IF EXISTS "Admins can view all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;

DROP POLICY IF EXISTS "Admins can view all drivers" ON drivers;
DROP POLICY IF EXISTS "Admins can insert drivers" ON drivers;
DROP POLICY IF EXISTS "Admins can update drivers" ON drivers;
DROP POLICY IF EXISTS "Admins can delete drivers" ON drivers;

DROP POLICY IF EXISTS "Admins can view all fuel records" ON fuel_records;
DROP POLICY IF EXISTS "Admins can insert fuel records" ON fuel_records;
DROP POLICY IF EXISTS "Admins can update fuel records" ON fuel_records;
DROP POLICY IF EXISTS "Admins can delete fuel records" ON fuel_records;

DROP POLICY IF EXISTS "Admins can view all system config" ON system_config;
DROP POLICY IF EXISTS "Admins can insert system config" ON system_config;
DROP POLICY IF EXISTS "Admins can update system config" ON system_config;
DROP POLICY IF EXISTS "Admins can delete system config" ON system_config;

-- Create new simplified policies for admins table
CREATE POLICY "Enable read access for authenticated users" ON admins FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON admins FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for own record" ON admins FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Enable delete for own record" ON admins FOR DELETE USING (auth.uid() = id);

-- Create new simplified policies for vehicles table
CREATE POLICY "Enable read access for authenticated users" ON vehicles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON vehicles FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON vehicles FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON vehicles FOR DELETE USING (auth.role() = 'authenticated');

-- Create new simplified policies for drivers table
CREATE POLICY "Enable read access for authenticated users" ON drivers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON drivers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON drivers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON drivers FOR DELETE USING (auth.role() = 'authenticated');

-- Create new simplified policies for fuel_records table
CREATE POLICY "Enable read access for authenticated users" ON fuel_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON fuel_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON fuel_records FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON fuel_records FOR DELETE USING (auth.role() = 'authenticated');

-- Create new simplified policies for system_config table
CREATE POLICY "Enable read access for authenticated users" ON system_config FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON system_config FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON system_config FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON system_config FOR DELETE USING (auth.role() = 'authenticated');

-- Supabase Database Schema for Fleet Management System

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    registration_number VARCHAR(50),
    fuel_type VARCHAR(50),
    fuel_capacity DECIMAL(10,2),
    current_mileage DECIMAL(12,2) DEFAULT 0,
    budget DECIMAL(12,2) DEFAULT 0,
    driver_id UUID REFERENCES drivers(id),
    traccar_device_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100),
    phone_number VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fuel_records table
CREATE TABLE IF NOT EXISTS fuel_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    session_date TIMESTAMP WITH TIME ZONE NOT NULL,
    fuel_amount DECIMAL(10,2),
    fuel_cost DECIMAL(12,2),
    current_mileage DECIMAL(12,2),
    fuel_efficiency DECIMAL(10,2),
    attendant VARCHAR(255),
    pump_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'owner')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_is_active ON vehicles(is_active);
CREATE INDEX IF NOT EXISTS idx_fuel_records_vehicle_id ON fuel_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_session_date ON fuel_records(session_date);
CREATE INDEX IF NOT EXISTS idx_drivers_is_active ON drivers(is_active);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fuel_records_updated_at BEFORE UPDATE ON fuel_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Set up Row Level Security (RLS)
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admins table
CREATE POLICY "Admins can view all admin records" ON admins FOR SELECT USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can insert admin records" ON admins FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admins WHERE role = 'owner' AND is_active = true));
CREATE POLICY "Admins can update admin records" ON admins FOR UPDATE USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Owners can delete admin records" ON admins FOR DELETE USING (auth.uid() IN (SELECT id FROM admins WHERE role = 'owner' AND is_active = true));

-- Create RLS policies for vehicles table
CREATE POLICY "Admins can view all vehicles" ON vehicles FOR SELECT USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can insert vehicles" ON vehicles FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can update vehicles" ON vehicles FOR UPDATE USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can delete vehicles" ON vehicles FOR DELETE USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));

-- Create RLS policies for drivers table
CREATE POLICY "Admins can view all drivers" ON drivers FOR SELECT USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can insert drivers" ON drivers FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can update drivers" ON drivers FOR UPDATE USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can delete drivers" ON drivers FOR DELETE USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));

-- Create RLS policies for fuel_records table
CREATE POLICY "Admins can view all fuel records" ON fuel_records FOR SELECT USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can insert fuel records" ON fuel_records FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can update fuel records" ON fuel_records FOR UPDATE USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can delete fuel records" ON fuel_records FOR DELETE USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));

-- Create RLS policies for system_config table
CREATE POLICY "Admins can view all system config" ON system_config FOR SELECT USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can insert system config" ON system_config FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can update system config" ON system_config FOR UPDATE USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));
CREATE POLICY "Admins can delete system config" ON system_config FOR DELETE USING (auth.uid() IN (SELECT id FROM admins WHERE is_active = true));

-- Insert initial system configuration
INSERT INTO system_config (key, value) VALUES 
('app_name', 'Fleet Management System'),
('app_version', '1.0.0'),
('currency', 'ZMW'),
('fuel_efficiency_unit', 'L/100km')
ON CONFLICT (key) DO NOTHING;

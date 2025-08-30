-- Migration: 002_sample_data.sql
-- Insert sample data for testing

-- Sample drivers
INSERT INTO drivers (name, license_number, phone_number, email) VALUES 
('John Doe', 'DL123456', '+260123456789', 'john@example.com') 
ON CONFLICT DO NOTHING;

INSERT INTO drivers (name, license_number, phone_number, email) VALUES 
('Jane Smith', 'DL789012', '+260987654321', 'jane@example.com') 
ON CONFLICT DO NOTHING;

-- Sample vehicles
INSERT INTO vehicles (name, type, fuel_type, budget) VALUES 
('Toyota Hilux', 'Pickup Truck', 'Diesel', 5000.00) 
ON CONFLICT DO NOTHING;

INSERT INTO vehicles (name, type, fuel_type, budget) VALUES 
('Ford Ranger', 'Pickup Truck', 'Diesel', 4500.00) 
ON CONFLICT DO NOTHING;

INSERT INTO vehicles (name, type, fuel_type, budget) VALUES 
('Nissan Navara', 'Pickup Truck', 'Diesel', 4800.00) 
ON CONFLICT DO NOTHING;

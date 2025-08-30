import { createClient } from '@supabase/supabase-js';

console.log('🚀 NUMZFLEET - Creating Database Tables');
console.log('========================================\n');

// Supabase configuration
const supabaseUrl = 'https://yyqvediztsrlugentoca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSvENKO3US3gHLp_RoYbZt5HOM';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  try {
    console.log('🔗 Connecting to Supabase...');
    
    // Test connection
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    console.log('✅ Connected to Supabase!\n');
    
    console.log('📋 Creating database tables...\n');
    
    // Create tables one by one using raw SQL via the client
    console.log('1️⃣  Creating drivers table...');
    try {
      const { error } = await supabase.rpc('exec_sql', { 
        sql: `
          CREATE TABLE IF NOT EXISTS drivers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            license_number VARCHAR(100) UNIQUE,
            phone_number VARCHAR(50),
            email VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      if (error) {
        console.log(`⚠️  Drivers table: ${error.message}`);
        console.log('   Trying alternative method...');
        // Try creating via direct table operations
        const { error: createError } = await supabase.from('drivers').select('*').limit(1);
        if (createError && createError.code === 'PGRST116') {
          console.log('   Table drivers does not exist yet');
        }
      } else {
        console.log('✅ Drivers table created successfully!');
      }
    } catch (err) {
      console.log(`⚠️  Drivers table: ${err.message}`);
    }
    
    console.log('2️⃣  Creating vehicles table...');
    try {
      const { error } = await supabase.rpc('exec_sql', { 
        sql: `
          CREATE TABLE IF NOT EXISTS vehicles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            type VARCHAR(100) NOT NULL,
            registration_number VARCHAR(50) UNIQUE,
            fuel_type VARCHAR(50),
            fuel_capacity DECIMAL(10,2),
            current_mileage DECIMAL(12,2) DEFAULT 0,
            budget DECIMAL(12,2) DEFAULT 0,
            driver_id UUID,
            traccar_device_id VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      if (error) {
        console.log(`⚠️  Vehicles table: ${error.message}`);
      } else {
        console.log('✅ Vehicles table created successfully!');
      }
    } catch (err) {
      console.log(`⚠️  Vehicles table: ${err.message}`);
    }
    
    console.log('3️⃣  Creating fuel_records table...');
    try {
      const { error } = await supabase.rpc('exec_sql', { 
        sql: `
          CREATE TABLE IF NOT EXISTS fuel_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vehicle_id UUID NOT NULL,
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
        `
      });
      if (error) {
        console.log(`⚠️  Fuel records table: ${error.message}`);
      } else {
        console.log('✅ Fuel records table created successfully!');
      }
    } catch (err) {
      console.log(`⚠️  Fuel records table: ${err.message}`);
    }
    
    console.log('4️⃣  Creating system_config table...');
    try {
      const { error } = await supabase.rpc('exec_sql', { 
        sql: `
          CREATE TABLE IF NOT EXISTS system_config (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(255) NOT NULL UNIQUE,
            value TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      if (error) {
        console.log(`⚠️  System config table: ${error.message}`);
      } else {
        console.log('✅ System config table created successfully!');
      }
    } catch (err) {
      console.log(`⚠️  System config table: ${err.message}`);
    }
    
    // Try to insert initial system configuration
    console.log('5️⃣  Setting up initial configuration...');
    try {
      const { error } = await supabase.from('system_config').upsert([
        { key: 'app_name', value: 'NUMZFLEET' },
        { key: 'app_version', value: '1.0.0' },
        { key: 'currency', value: 'ZMW' },
        { key: 'fuel_efficiency_unit', value: 'L/100km' }
      ], { onConflict: 'key' });
      
      if (error) {
        console.log(`⚠️  System config: ${error.message}`);
      } else {
        console.log('✅ Initial configuration set successfully!');
      }
    } catch (err) {
      console.log(`⚠️  System config: ${err.message}`);
    }
    
    // Verify tables exist
    console.log('\n🔍 Verifying database setup...');
    const tables = ['drivers', 'vehicles', 'fuel_records', 'system_config'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`✅ Table ${table}: Ready`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: ${err.message}`);
      }
    }
    
    console.log('\n📝 Summary:');
    console.log('   - Connection: ✅ Working');
    console.log('   - Tables: Attempted to create');
    console.log('   - Next step: Check status with "npm run db:status"');
    
    console.log('\n🎯 If tables were not created, you may need to:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Copy SQL from "npm run db:setup"');
    console.log('   3. Paste and run in the dashboard');
    
  } catch (error) {
    console.error('\n❌ Failed to create tables:', error.message);
    console.log('\n🔧 Alternative method:');
    console.log('1. Run "npm run db:setup" to get the SQL');
    console.log('2. Copy the SQL to Supabase Dashboard > SQL Editor');
    console.log('3. Click "Run" to execute');
  }
}

// Run the table creation
createTables();

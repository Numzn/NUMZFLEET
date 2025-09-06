import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  console.log('VITE_SUPABASE_URL:', supabaseUrl);
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '***' + supabaseKey.slice(-10) : 'undefined');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Checking database schema...');
    
    // Check if vehicles table has the required columns
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'vehicles')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    if (error) {
      console.error('❌ Error checking schema:', error);
      return;
    }

    console.log('\n📋 Vehicles table columns:');
    console.log('─'.repeat(60));
    
    const requiredColumns = [
      'id', 'name', 'model', 'type', 'registration_number', 
      'fuel_type', 'fuel_capacity', 'current_mileage', 'budget', 
      'actual', 'driver_id', 'traccar_device_id', 'is_active', 
      'created_at', 'updated_at'
    ];

    let missingColumns = [];
    
    columns.forEach(col => {
      const status = requiredColumns.includes(col.column_name) ? '✅' : '⚠️';
      console.log(`${status} ${col.column_name.padEnd(20)} | ${col.data_type.padEnd(15)} | ${col.is_nullable} | ${col.column_default || 'NULL'}`);
    });

    // Check for missing required columns
    const existingColumns = columns.map(col => col.column_name);
    missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('\n❌ MISSING COLUMNS:');
      missingColumns.forEach(col => console.log(`   - ${col}`));
      console.log('\n🔧 You need to run the migration!');
      console.log('   Run: node supabase/add-actual-column.sql');
    } else {
      console.log('\n✅ All required columns are present!');
      console.log('   No migration needed.');
    }

    // Check if there are any vehicles
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('count')
      .limit(1);

    if (vehiclesError) {
      console.log('\n⚠️ Could not check vehicles table (might not exist yet)');
    } else {
      console.log('\n📊 Database is ready for vehicle creation!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDatabaseSchema();

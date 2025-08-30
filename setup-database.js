import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 NUMZFLEET Automated Database Setup');
console.log('=====================================\n');

// Supabase configuration
const supabaseUrl = 'https://yyqvediztsrlugentoca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSvENKO3US3gHLp_RoYbZt5HOM';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  try {
    console.log('🔗 Testing Supabase connection...');
    
    // Test connection by making a simple query to verify we can connect
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    
    console.log('✅ Connected to Supabase successfully!\n');
    
    // Read the migration file
    const schemaPath = path.join(__dirname, 'supabase', 'migrations', '001_initial_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Database Setup Instructions');
    console.log('===============================\n');
    console.log('Since we cannot create tables directly via the client, please follow these steps:\n');
    
    console.log('1️⃣  Go to Supabase Dashboard:');
    console.log('   🔗 https://supabase.com/dashboard\n');
    
    console.log('2️⃣  Select your project:');
    console.log('   📁 yyqvediztsrlugentoca\n');
    
    console.log('3️⃣  Go to SQL Editor (left sidebar)\n');
    
    console.log('4️⃣  Copy and paste this SQL code:');
    console.log('   ⬇️  START COPYING BELOW THIS LINE ⬇️');
    console.log('   ======================================');
    console.log(schema);
    console.log('   ======================================');
    console.log('   ⬆️  STOP COPYING ABOVE THIS LINE ⬆️\n');
    
    console.log('5️⃣  Click "Run" to execute the SQL\n');
    
    console.log('6️⃣  After execution, verify tables exist:');
    console.log('   - Go to "Table Editor" in the left sidebar');
    console.log('   - You should see: drivers, vehicles, fuel_records, system_config\n');
    
    console.log('🎯 What this will create:');
    console.log('   ✅ drivers table (no dependencies)');
    console.log('   ✅ vehicles table (references drivers)');
    console.log('   ✅ fuel_records table (references vehicles)');
    console.log('   ✅ system_config table (no dependencies)');
    console.log('   ✅ Proper foreign key relationships');
    console.log('   ✅ Row Level Security (RLS) policies');
    console.log('   ✅ Initial system configuration\n');
    
    console.log('🚀 Once complete, your frontend will connect successfully!');
    console.log('   Run "npm run dev" to start the development server.\n');
    
    // Check if tables already exist
    console.log('🔍 Checking current database state...');
    const tables = ['drivers', 'vehicles', 'fuel_records', 'system_config'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ Table ${table}: Not found (needs to be created)`);
        } else {
          console.log(`✅ Table ${table}: Already exists`);
        }
      } catch (err) {
        console.log(`❌ Table ${table}: Not found (needs to be created)`);
      }
    }
    
    console.log('\n📝 Summary:');
    console.log('   - Connection: ✅ Working');
    console.log('   - Tables: Need to be created via dashboard');
    console.log('   - Next step: Copy SQL above and run in Supabase dashboard');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n🔧 Alternative setup method:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project: yyqvediztsrlugentoca');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy and paste the SQL from supabase/migrations/001_initial_schema.sql');
    console.log('5. Click "Run"');
    
    process.exit(1);
  }
}

// Run the setup
setupDatabase();

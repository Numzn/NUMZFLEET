import { createClient } from '@supabase/supabase-js';

console.log('🚀 NUMZFLEET - Database Status Check');
console.log('=====================================\n');

// Supabase configuration with service role key
const supabaseUrl = 'https://yyqvediztsrlugentoca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MzU1NSwiZXhwIjoyMDcxOTY5NTU1fQ.plcuGiTLfpb4zn4q3c04ikzsF6lxxKDGM_Dyt6AS5dU';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkDatabaseStatus() {
  try {
    console.log('🔗 Checking database connection...');
    
    const tables = ['drivers', 'vehicles', 'fuel_records', 'admins', 'system_config'];
    let allTablesExist = true;
    
    console.log('\n📊 Database Tables Status:');
    console.log('==========================');
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
          allTablesExist = false;
        } else {
          const count = await supabase.from(table).select('*', { count: 'exact' });
          console.log(`✅ ${table}: ${count.count || 0} records`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
        allTablesExist = false;
      }
    }
    
    console.log('\n🎯 Quick Actions:');
    console.log('==================');
    
    if (allTablesExist) {
      console.log('✅ Database is fully set up!');
      console.log('   Your app should work perfectly.');
      console.log('   Test login at: http://localhost:5173/');
    } else {
      console.log('⚠️  Some tables are missing.');
      console.log('   Run: npm run db:setup');
    }
    
    console.log('\n📋 Available Commands:');
    console.log('   npm run db:setup    → Deploy database schema');
    console.log('   npm run db:status   → Check current status');
    console.log('   npm run db:reset    → Reset database');
    console.log('   npm run db:deploy   → Deploy changes');
    console.log('   npm run db:help     → Show detailed help');
    
  } catch (error) {
    console.error('\n❌ Database check failed:', error.message);
  }
}

checkDatabaseStatus();

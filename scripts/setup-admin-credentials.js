import { createClient } from '@supabase/supabase-js';

console.log('🚀 NUMZFLEET - Admin Credentials Setup');
console.log('========================================\n');

// Supabase configuration with service role key
const supabaseUrl = 'https://yyqvediztsrlugentoca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MzU1NSwiZXhwIjoyMDcxOTY5NTU1fQ.plcuGiTLfpb4zn4q3c04ikzsF6lxxKDGM_Dyt6AS5dU';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function setupAdminCredentials() {
  try {
    console.log('🔗 Setting up admin credentials...\n');
    
    // Step 1: Create admin user in Supabase Auth
    console.log('1️⃣ Creating admin user in Supabase Auth...');
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@numzfleet.com',
      password: 'admin1234',
      email_confirm: true,
      user_metadata: { role: 'owner' }
    });
    
    if (authError) {
      console.log(`⚠️  Auth user creation: ${authError.message}`);
    } else {
      console.log('✅ Admin user created in Supabase Auth');
    }
    
    // Step 2: Create second admin user
    console.log('\n2️⃣ Creating second admin user...');
    
    const { data: authData2, error: authError2 } = await supabase.auth.admin.createUser({
      email: 'numerinyirenda14gmail.com',
      password: 'numz0099',
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });
    
    if (authError2) {
      console.log(`⚠️  Second auth user creation: ${authError2.message}`);
    } else {
      console.log('✅ Second admin user created in Supabase Auth');
    }
    
    // Step 3: Check if admins table exists and has records
    console.log('\n3️⃣ Checking admins table...');
    
    try {
      const { data: admins, error: adminsError } = await supabase
        .from('admins')
        .select('*');
      
      if (adminsError) {
        console.log(`❌ Admins table error: ${adminsError.message}`);
      } else {
        console.log(`✅ Admins table has ${admins.length} records`);
        admins.forEach(admin => {
          console.log(`   - ${admin.email} (${admin.role})`);
        });
      }
    } catch (err) {
      console.log(`❌ Admins table check failed: ${err.message}`);
    }
    
    console.log('\n🎯 Login Credentials:');
    console.log('=====================');
    console.log('Email: admin@numzfleet.com');
    console.log('Password: admin1234');
    console.log('');
    console.log('Email: numerinyirenda14gmail.com');
    console.log('Password: numz0099');
    console.log('\n🚀 Test your login at: http://localhost:5173/');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
  }
}

setupAdminCredentials();

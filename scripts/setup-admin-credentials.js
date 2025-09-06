import { createClient } from '@supabase/supabase-js';

console.log('🚀 NUMZFLEET - Admin Credentials Setup');
console.log('========================================\n');

// Supabase configuration with service role key (has admin permissions)
const supabaseUrl = 'https://yyqvediztsrlugentoca.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MzU1NSwiZXhwIjoyMDcxOTY5NTU1fQ.plcuGiTLfpb4zn4q3c04ikzsF6lxxKDGM_Dyt6AS5dU';

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function setupAdminCredentials() {
  try {
    console.log('🔗 Setting up admin credentials...\n');
    
    // Step 1: Create admin user in Supabase Auth using service role
    console.log('1️⃣ Creating admin user in Supabase Auth...');
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@numzfleet.com',
      password: 'admin1234',
      email_confirm: true,
      user_metadata: { role: 'owner' }
    });
    
    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('✅ Admin user already exists in Supabase Auth');
      } else {
        console.log(`⚠️  Auth user creation: ${authError.message}`);
      }
    } else {
      console.log('✅ Admin user created in Supabase Auth');
    }
    
    // Step 2: Create second admin user
    console.log('\n2️⃣ Creating second admin user...');
    
    const { data: authData2, error: authError2 } = await supabaseAdmin.auth.admin.createUser({
      email: 'numerinyirenda14@gmail.com', // Fixed email format
      password: 'numz0099',
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });
    
    if (authError2) {
      if (authError2.message.includes('already been registered')) {
        console.log('✅ Second admin user already exists in Supabase Auth');
      } else {
        console.log(`⚠️  Second auth user creation: ${authError2.message}`);
      }
    } else {
      console.log('✅ Second admin user created in Supabase Auth');
    }
    
    // Step 3: Check if admins table exists and has records
    console.log('\n3️⃣ Checking admins table...');
    
    try {
      const { data: admins, error: adminsError } = await supabaseAdmin
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

    // Step 4: Test authentication with the created users
    console.log('\n4️⃣ Testing authentication...');
    
    // Test with anon key (like the frontend would use)
    const supabaseAnon = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSv');
    
    console.log('Testing login with admin@numzfleet.com...');
    const { data: testAuth, error: testError } = await supabaseAnon.auth.signInWithPassword({
      email: 'admin@numzfleet.com',
      password: 'admin1234'
    });
    
    if (testError) {
      console.log(`❌ Test login failed: ${testError.message}`);
    } else {
      console.log('✅ Test login successful!');
      await supabaseAnon.auth.signOut();
    }
    
    console.log('\n🎯 Login Credentials:');
    console.log('=====================');
    console.log('Email: admin@numzfleet.com');
    console.log('Password: admin1234');
    console.log('');
    console.log('Email: numerinyirenda14@gmail.com');
    console.log('Password: numz0099');
    console.log('\n🚀 Test your login at: http://localhost:5174/');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
  }
}

setupAdminCredentials();

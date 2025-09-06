import { createClient } from '@supabase/supabase-js';

console.log('🔐 NUMZFLEET - Create Admin User in Supabase Auth');
console.log('================================================\n');

// IMPORTANT: You need to get these from your Supabase dashboard
// Go to: https://supabase.com/dashboard/project/yyqvediztsrlugentoca/settings/api
const supabaseUrl = 'https://yyqvediztsrlugentoca.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5MzU1NSwiZXhwIjoyMDcxOTY5NTU1fQ.plcuGiTLfpb4zn4q3c04ikzsF6lxxKDGM_Dyt6AS5dU';

console.log('🔑 Using Service Role Key (this has admin permissions)');
console.log('📧 Creating admin user: admin@numzfleet.com');
console.log('🔒 Password: admin1234\n');

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdminUser() {
  try {
    console.log('🚀 Step 1: Creating user in Supabase Auth...');
    
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@numzfleet.com',
      password: 'admin1234',
      email_confirm: true,
      user_metadata: { 
        role: 'owner',
        name: 'System Administrator'
      }
    });

    if (userError) {
      if (userError.message.includes('already been registered')) {
        console.log('✅ User already exists in Supabase Auth');
        console.log('   User ID:', userError.message.split('User ID: ')[1] || 'Unknown');
      } else {
        console.error('❌ Failed to create user:', userError.message);
        return;
      }
    } else {
      console.log('✅ User created successfully in Supabase Auth!');
      console.log('   User ID:', userData.user.id);
      console.log('   Email:', userData.user.email);
    }

    console.log('\n🚀 Step 2: Creating admin record in admins table...');
    
    // Get the user ID (either from creation or existing user)
    let userId;
    if (userData?.user?.id) {
      userId = userData.user.id;
    } else {
      // Try to get existing user
      const { data: existingUser, error: lookupError } = await supabaseAdmin.auth.admin.listUsers();
      if (lookupError) {
        console.error('❌ Cannot lookup users:', lookupError.message);
        return;
      }
      const adminUser = existingUser.users.find(u => u.email === 'admin@numzfleet.com');
      if (adminUser) {
        userId = adminUser.id;
        console.log('✅ Found existing user with ID:', userId);
      } else {
        console.error('❌ Could not find admin user');
        return;
      }
    }

    // Create admin record
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .upsert({
        id: userId,
        email: 'admin@numzfleet.com',
        role: 'owner',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (adminError) {
      console.error('❌ Failed to create admin record:', adminError.message);
    } else {
      console.log('✅ Admin record created/updated successfully!');
    }

    console.log('\n🚀 Step 3: Testing authentication...');
    
    // Test with anon key (like your frontend will use)
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSv';
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    
    console.log('🔑 Testing login with anon key...');
    const { data: testAuth, error: testError } = await supabaseAnon.auth.signInWithPassword({
      email: 'admin@numzfleet.com',
      password: 'admin1234'
    });
    
    if (testError) {
      console.error('❌ Test login failed:', testError.message);
      console.log('\n🔍 Troubleshooting:');
      console.log('   1. Check if the anon key is correct');
      console.log('   2. Verify the user was created in Supabase Auth');
      console.log('   3. Check Supabase dashboard for any errors');
    } else {
      console.log('✅ Test login successful!');
      console.log('   Session created:', !!testAuth.session);
      console.log('   User authenticated:', !!testAuth.user);
      
      // Sign out
      await supabaseAnon.auth.signOut();
      console.log('✅ Signed out successfully');
    }

    console.log('\n🎯 Your Admin Account:');
    console.log('======================');
    console.log('Email: admin@numzfleet.com');
    console.log('Password: admin1234');
    console.log('Role: owner');
    console.log('\n🚀 Now try logging in at: http://localhost:5174/');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n🔍 Common issues:');
    console.log('   1. Service role key might be incorrect');
    console.log('   2. Supabase project might be paused');
    console.log('   3. Network connectivity issues');
  }
}

createAdminUser();

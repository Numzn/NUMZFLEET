import { createClient } from '@supabase/supabase-js';

console.log('🔐 NUMZFLEET - Authentication Test');
console.log('==================================\n');

// Supabase configuration
const supabaseUrl = 'https://yyqvediztsrlugentoca.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSvENKO3US3gHLp_RoYbZt5HOM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuthentication() {
  try {
    console.log('🔗 Testing Supabase connection...');
    
    // Test 1: Check if we can connect
    const { data: connectionTest, error: connectionError } = await supabase.auth.getSession();
    if (connectionError) {
      console.error('❌ Connection error:', connectionError);
      return;
    }
    console.log('✅ Supabase connection successful\n');

    // Test 2: Try to sign in with admin credentials
    console.log('🔑 Testing admin login...');
    console.log('Email: admin@numzfleet.com');
    console.log('Password: admin1234\n');
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@numzfleet.com',
      password: 'admin1234'
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      console.error('Error details:', authError);
      
      // Let's check if the user exists
      console.log('\n🔍 Checking if user exists...');
      try {
        const { data: userCheck, error: userCheckError } = await supabase.auth.admin.listUsers();
        if (userCheckError) {
          console.error('❌ Cannot check users (insufficient permissions):', userCheckError.message);
        } else {
          console.log('✅ User check successful');
          console.log('Users found:', userCheck?.length || 0);
        }
      } catch (err) {
        console.error('❌ User check failed:', err.message);
      }
      
    } else {
      console.log('✅ Authentication successful!');
      console.log('User ID:', authData.user.id);
      console.log('User email:', authData.user.email);
      console.log('Session:', !!authData.session);
      
      // Test 3: Check admin record
      console.log('\n🔍 Checking admin record...');
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('email', 'admin@numzfleet.com')
        .single();
      
      if (adminError) {
        console.error('❌ Admin record check failed:', adminError);
      } else {
        console.log('✅ Admin record found:', adminData);
      }
      
      // Sign out
      await supabase.auth.signOut();
      console.log('✅ Signed out successfully');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAuthentication();

import { createClient } from '@supabase/supabase-js';

console.log('🔑 NUMZFLEET - Test Supabase Anon Key');
console.log('======================================\n');

// Test with the current anon key
const supabaseUrl = 'https://yyqvediztsrlugentoca.supabase.co';
const currentAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSv';

console.log('🔍 Testing current anon key...');
console.log('URL:', supabaseUrl);
console.log('Key (first 50 chars):', currentAnonKey.substring(0, 50) + '...');
console.log('Key length:', currentAnonKey.length, 'characters\n');

// Create client with current key
const supabase = createClient(supabaseUrl, currentAnonKey);

async function testConnection() {
  try {
    console.log('🚀 Step 1: Testing basic connection...');
    
    // Try to get session (this should work even without auth)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Connection failed:', sessionError.message);
      console.log('🔍 This means the anon key is invalid or expired');
      return;
    }
    
    console.log('✅ Basic connection successful!');
    console.log('Session data:', sessionData);
    
    console.log('\n🚀 Step 2: Testing database access...');
    
    // Try to access a public table
    const { data: testData, error: testError } = await supabase
      .from('vehicles')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database access failed:', testError.message);
      console.log('🔍 This might be a permissions issue');
    } else {
      console.log('✅ Database access successful!');
      console.log('Test data:', testData);
    }
    
    console.log('\n🚀 Step 3: Testing authentication endpoint...');
    
    // Try to sign in (this will fail with wrong credentials, but shouldn't fail with "Invalid API key")
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@numzfleet.com',
      password: 'admin1234'
    });
    
    if (authError) {
      if (authError.message.includes('Invalid API key')) {
        console.error('❌ INVALID API KEY - This is the problem!');
        console.log('🔍 You need to get the correct anon key from your Supabase dashboard');
      } else if (authError.message.includes('Invalid login credentials')) {
        console.log('✅ API key is working!');
        console.log('❌ But login credentials are wrong (this is a different problem)');
      } else {
        console.log('⚠️  Other auth error:', authError.message);
      }
    } else {
      console.log('✅ Authentication successful!');
      console.log('User:', authData.user.email);
      
      // Sign out
      await supabase.auth.signOut();
      console.log('✅ Signed out successfully');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testConnection();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configure dotenv for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
  console.log('🧪 Testing Authentication System');
  console.log('================================\n');

  try {
    // 1. Check admins table
    console.log('1️⃣ Checking admins table...');
    const { data: admins, error: adminsError } = await supabase
      .from('admins')
      .select('*');

    if (adminsError) {
      console.error('❌ Error fetching admins:', adminsError);
      return;
    }

    console.log(`✅ Found ${admins.length} admin users:`);
    admins.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.email} (${admin.role})`);
    });

    // 2. Test login with first admin
    if (admins.length > 0) {
      const testAdmin = admins[0];
      console.log(`\n2️⃣ Testing login with: ${testAdmin.email}`);
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: testAdmin.email,
        password: 'admin1234', // Default password
      });

      if (authError) {
        console.log('⚠️ Login test failed (expected if password is different):', authError.message);
      } else {
        console.log('✅ Login test successful!');
        console.log('   User ID:', authData.user.id);
        console.log('   Email:', authData.user.email);
        
        // 3. Test admin user lookup
        console.log('\n3️⃣ Testing admin user lookup...');
        const { data: adminUser, error: lookupError } = await supabase
          .from('admins')
          .select('*')
          .eq('email', authData.user.email)
          .single();

        if (lookupError) {
          console.error('❌ Admin lookup failed:', lookupError);
        } else {
          console.log('✅ Admin lookup successful!');
          console.log('   Admin ID:', adminUser.id);
          console.log('   Role:', adminUser.role);
        }

        // Sign out
        await supabase.auth.signOut();
      }
    }

    // 4. Test database connection
    console.log('\n4️⃣ Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('vehicles')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('❌ Database connection failed:', testError);
    } else {
      console.log('✅ Database connection successful!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAuth().then(() => {
  console.log('\n🏁 Test completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test error:', error);
  process.exit(1);
});

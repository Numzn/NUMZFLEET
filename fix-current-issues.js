#!/usr/bin/env node

/**
 * Quick Fix Script for Current Issues
 * This script addresses the immediate problems:
 * 1. Traccar connection refused (localhost:8082)
 * 2. Missing 'model' column in vehicles table
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Fleet Management Application - Quick Fix');
console.log('==========================================\n');

const clientDir = path.join(__dirname, 'client');
const envLocalPath = path.join(clientDir, '.env.local');

// Check if .env.local exists
if (!fs.existsSync(envLocalPath)) {
  console.log('📝 Creating .env.local file...');
  
  // Create .env.local with production Traccar server
  const envContent = `# ===========================================
# SUPABASE CONFIGURATION
# ===========================================
# Update these with your actual Supabase credentials
VITE_SUPABASE_URL=https://yyqvediztsrlugentoca.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# ===========================================
# TRACCAR SERVER CONFIGURATION
# ===========================================
# Using remote Traccar server to avoid localhost:8082 connection issues
VITE_TRACCAR_URL=https://fleet.numz.site
VITE_TRACCAR_AUTH=bjVtZXJpbnl5aXJlbmRhMTRAZ21haWwuY29tOm51bXowMDk5

# ===========================================
# APPLICATION SETTINGS
# ===========================================
VITE_APP_MODE=development
VITE_API_TIMEOUT=10000
VITE_DEBUG=true
`;

  try {
    fs.writeFileSync(envLocalPath, envContent);
    console.log('✅ .env.local created successfully!');
    console.log('⚠️  Please update VITE_SUPABASE_ANON_KEY with your actual Supabase key');
  } catch (error) {
    console.error('❌ Error creating .env.local:', error.message);
  }
} else {
  console.log('✅ .env.local already exists');
}

console.log('\n🔍 Current Issues and Solutions:');
console.log('================================');

console.log('\n1. ❌ Traccar Connection Refused (localhost:8082)');
console.log('   ✅ Solution: Updated VITE_TRACCAR_URL to use remote server');
console.log('   📍 New URL: https://fleet.numz.site');

console.log('\n2. ❌ Missing "model" column in vehicles table');
console.log('   ✅ Solution: Database schema needs to be updated');
console.log('   📍 Required SQL:');
console.log('   ALTER TABLE vehicles ADD COLUMN model VARCHAR;');

console.log('\n📋 Next Steps:');
console.log('==============');
console.log('1. Update your Supabase anon key in .env.local');
console.log('2. Run the SQL command to add the "model" column:');
console.log('   ALTER TABLE vehicles ADD COLUMN model VARCHAR;');
console.log('3. Restart your development server');
console.log('4. Test the application');

console.log('\n🚀 To restart the development server:');
console.log('   cd client && npm run dev');

console.log('\n📚 For detailed setup instructions, see ENVIRONMENT-SETUP.md');

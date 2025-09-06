#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('🚀 Setting up Vercel environment variables automatically...\n');

// Environment variables to set
const envVars = {
  // Supabase Configuration
  'VITE_SUPABASE_URL': 'https://yyqvediztsrlugentoca.supabase.co',
  'VITE_SUPABASE_ANON_KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSv',
   
  // Traccar Configuration
  'VITE_TRACCAR_URL': 'https://your-production-traccar-server.com',
  'VITE_TRACCAR_AUTH': 'YWRtaW46YWRtaW4=',
  'VITE_USE_TRACCAR_SIMULATION': 'false'
};

async function setupVercelEnv() {
  try {
    console.log('📋 Setting environment variables...\n');
    
    for (const [key, value] of Object.entries(envVars)) {
      console.log(`Setting ${key}...`);
      try {
        execSync(`vercel env add ${key} production`, { 
          input: value + '\n',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(`✅ ${key} set successfully`);
      } catch (error) {
        console.log(`⚠️ ${key} might already exist or need manual setup`);
      }
    }
    
    console.log('\n🎉 Environment variables setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Run: vercel --prod');
    console.log('2. Your project will be deployed with all variables configured');
    
  } catch (error) {
    console.error('❌ Error setting up environment variables:', error.message);
    console.log('\n🔧 Manual setup required:');
    console.log('1. Go to Vercel dashboard');
    console.log('2. Settings → Environment Variables');
    console.log('3. Add each variable manually');
  }
}

setupVercelEnv();

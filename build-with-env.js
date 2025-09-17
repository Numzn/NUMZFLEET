#!/usr/bin/env node

// Set environment variables for build
process.env.VITE_SUPABASE_URL = 'https://yyqvediztsrlugentoca.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSvENKO3US3gHLp_RoYbZt5HOM';
process.env.VITE_TRACCAR_URL = 'https://your-traccar-server.com';
process.env.VITE_TRACCAR_USERNAME = 'admin';
process.env.VITE_TRACCAR_PASSWORD = 'admin';
process.env.VITE_USE_TRACCAR_SIMULATION = 'true';

// Import and run the build
import { execSync } from 'child_process';

try {
  console.log('🔧 Building with environment variables...');
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

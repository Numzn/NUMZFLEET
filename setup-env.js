#!/usr/bin/env node

/**
 * Environment Setup Script
 * This script helps set up the environment configuration for the Fleet Management Application
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupEnvironment() {
  console.log('🚀 Fleet Management Application - Environment Setup');
  console.log('================================================\n');

  const clientDir = path.join(__dirname, 'client');
  const envLocalPath = path.join(clientDir, '.env.local');
  const envExamplePath = path.join(__dirname, 'env.example');

  // Check if .env.local already exists
  if (fs.existsSync(envLocalPath)) {
    const overwrite = await question('⚠️  .env.local already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ Setup cancelled.');
      rl.close();
      return;
    }
  }

  console.log('📋 Please provide the following information:\n');

  // Supabase Configuration
  console.log('🔧 Supabase Configuration:');
  const supabaseUrl = await question('Supabase URL (e.g., https://your-project.supabase.co): ');
  const supabaseKey = await question('Supabase Anon Key: ');

  // Traccar Configuration
  console.log('\n🌐 Traccar Configuration:');
  const traccarUrl = await question('Traccar URL (default: http://localhost:8082): ') || 'http://localhost:8082';
  const traccarEmail = await question('Traccar Email: ');
  const traccarPassword = await question('Traccar Password: ');

  // Generate base64 auth
  const traccarAuth = Buffer.from(`${traccarEmail}:${traccarPassword}`).toString('base64');

  // Application Settings
  console.log('\n⚙️  Application Settings:');
  const appMode = await question('App Mode (development/production, default: development): ') || 'development';
  const debug = await question('Enable Debug Mode? (y/N): ');

  // Create .env.local content
  const envContent = `# ===========================================
# SUPABASE CONFIGURATION
# ===========================================
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseKey}

# ===========================================
# TRACCAR SERVER CONFIGURATION
# ===========================================
VITE_TRACCAR_URL=${traccarUrl}
VITE_TRACCAR_AUTH=${traccarAuth}

# ===========================================
# APPLICATION SETTINGS
# ===========================================
VITE_APP_MODE=${appMode}
VITE_API_TIMEOUT=10000
VITE_DEBUG=${debug.toLowerCase() === 'y' ? 'true' : 'false'}
`;

  try {
    // Ensure client directory exists
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }

    // Write .env.local
    fs.writeFileSync(envLocalPath, envContent);
    console.log('\n✅ .env.local created successfully!');

    // Copy env.example to client directory
    if (fs.existsSync(envExamplePath)) {
      const clientEnvExamplePath = path.join(clientDir, '.env.example');
      fs.copyFileSync(envExamplePath, clientEnvExamplePath);
      console.log('✅ .env.example copied to client directory');
    }

    console.log('\n🎉 Environment setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Start your Traccar server (if using localhost:8082)');
    console.log('2. Run: cd client && npm install');
    console.log('3. Run: npm run dev');
    console.log('\n⚠️  Remember: Never commit .env.local to version control!');

  } catch (error) {
    console.error('❌ Error creating environment file:', error.message);
  }

  rl.close();
}

// Run the setup
setupEnvironment().catch(console.error);

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Coordinate Optimization Service...\n');

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created .env file from template');
  } else {
    // Create basic .env file
    const envContent = `# Coordinate Optimization Service Environment Variables

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5174

# Traccar Configuration
TRACCAR_URL=https://fleet.numz.site
TRACCAR_AUTH=bnVtZXJpbnl5aXJlbmRhMTRAZ21haWwuY29tOm51bXowMDk5

# Cache Configuration
CACHE_TTL=300

# Optimization Defaults
DEFAULT_TOLERANCE=10
DEFAULT_MIN_SPEED=5
DEFAULT_MIN_TIME_INTERVAL=30000
DEFAULT_MAX_SPEED=200
DEFAULT_MIN_ACCURACY=100
`;
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env file with default values');
  }
} else {
  console.log('ℹ️  .env file already exists');
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
const { execSync } = require('child_process');

try {
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Create logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
  console.log('✅ Created logs directory');
}

// Test the service
console.log('\n🧪 Testing the service...');
try {
  const { spawn } = require('child_process');
  
  // Start the service in test mode
  const service = spawn('node', ['src/server.js'], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'test' }
  });

  let output = '';
  service.stdout.on('data', (data) => {
    output += data.toString();
  });

  service.stderr.on('data', (data) => {
    output += data.toString();
  });

  // Wait a bit for the service to start
  setTimeout(() => {
    service.kill();
    
    if (output.includes('Coordinate Optimization Service running')) {
      console.log('✅ Service started successfully');
    } else {
      console.log('⚠️  Service may have issues starting');
      console.log('Output:', output);
    }
  }, 3000);

} catch (error) {
  console.error('❌ Failed to test service:', error.message);
}

console.log('\n🎉 Setup complete!');
console.log('\n📋 Next steps:');
console.log('1. Review and update .env file with your settings');
console.log('2. Start the service: npm run dev');
console.log('3. Test the health endpoint: curl http://localhost:3001/health');
console.log('4. Update your frontend to use the optimization service');
console.log('\n📚 Documentation: README.md');
console.log('🔧 API Health: http://localhost:3001/health');
console.log('📊 API Docs: http://localhost:3001/api/devices');



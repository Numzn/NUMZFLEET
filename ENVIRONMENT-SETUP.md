# Environment Setup Guide

This document outlines the complete environment configuration for the Fleet Management Application.

## 📁 Environment File Structure

### Required Environment Files

```
client/
├── .env.local          # Local development environment (DO NOT COMMIT)
├── .env.example        # Template for environment variables (COMMIT THIS)
└── .env                # Fallback environment (OPTIONAL)
```

## 🔧 Environment Variables

### 1. Supabase Configuration
```bash
# Supabase Project Settings
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Traccar Server Configuration
```bash
# Traccar Server URL (Choose ONE option)
# Option A: Local Traccar Server (for development)
VITE_TRACCAR_URL=http://localhost:8082

# Option B: Remote Traccar Server (for production)
VITE_TRACCAR_URL=https://fleet.numz.site

# Traccar Authentication (Base64 encoded email:password)
VITE_TRACCAR_AUTH=base64-encoded-credentials
```

### 3. Application Configuration
```bash
# Application Mode
VITE_APP_MODE=development  # or 'production'

# API Timeout Settings
VITE_API_TIMEOUT=10000

# Debug Mode
VITE_DEBUG=true
```

## 📋 Complete .env.local Template

Create `client/.env.local` with the following content:

```bash
# ===========================================
# SUPABASE CONFIGURATION
# ===========================================
# Get these from your Supabase project settings
VITE_SUPABASE_URL=https://yyqvediztsrlugentoca.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# ===========================================
# TRACCAR SERVER CONFIGURATION
# ===========================================
# For local development with Traccar server running on localhost:8082
VITE_TRACCAR_URL=http://localhost:8082

# For production or when using remote Traccar server
# VITE_TRACCAR_URL=https://fleet.numz.site

# Traccar authentication (Base64 encoded email:password)
# Example: numerinyirenda14@gmail.com:numz0099
VITE_TRACCAR_AUTH=base64-encoded-credentials

# ===========================================
# APPLICATION SETTINGS
# ===========================================
VITE_APP_MODE=development
VITE_API_TIMEOUT=10000
VITE_DEBUG=true
```

## 🚀 Setup Instructions

### Step 1: Create Environment File
```bash
# Navigate to client directory
cd client

# Create .env.local file
touch .env.local

# Copy the template above into .env.local
```

### Step 2: Configure Supabase
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon/public key
4. Update `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Step 3: Configure Traccar
Choose one of the following options:

#### Option A: Local Traccar Server
```bash
# Set for local development
VITE_TRACCAR_URL=http://localhost:8082
VITE_TRACCAR_AUTH=base64-encoded-credentials
```

#### Option B: Remote Traccar Server
```bash
# Set for production/remote server
VITE_TRACCAR_URL=https://fleet.numz.site
VITE_TRACCAR_AUTH=base64-encoded-credentials
```

### Step 4: Generate Traccar Auth
```bash
# Create base64 encoded credentials
# Format: email:password
echo -n "your-email@example.com:your-password" | base64
```

## 🔒 Security Notes

### Files to NEVER Commit
- `.env.local` - Contains sensitive local configuration
- `.env` - May contain sensitive data
- Any file with actual credentials

### Files to ALWAYS Commit
- `.env.example` - Template for other developers
- `ENVIRONMENT-SETUP.md` - This documentation

## 🐛 Troubleshooting

### Common Issues

#### 1. Traccar Connection Refused
```
Error: GET http://localhost:8082/api/devices net::ERR_CONNECTION_REFUSED
```
**Solution:**
- Ensure Traccar server is running on port 8082
- Check if `VITE_TRACCAR_URL` is set correctly
- Verify firewall settings

#### 2. Supabase Connection Issues
```
Error: Missing Supabase environment variables
```
**Solution:**
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Check if the Supabase project is active
- Ensure the anon key has correct permissions

#### 3. Database Schema Errors
```
Error: Could not find the 'model' column of 'vehicles'
```
**Solution:**
- Run database migrations to update schema
- Check if the database schema matches the application expectations

## 📊 Environment Validation

### Check Environment Setup
```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm run dev

# Check browser console for environment validation logs
```

### Expected Console Output
```
🔍 Supabase initialization: { hasUrl: true, hasKey: true, ... }
🌐 Traccar Configuration: { TRACCAR_BASE_URL: '...', MODE: '...' }
✅ Supabase client created successfully
```

## 🔄 Environment Switching

### Development Environment
```bash
# Use local Traccar server
VITE_TRACCAR_URL=http://localhost:8082
VITE_APP_MODE=development
VITE_DEBUG=true
```

### Production Environment
```bash
# Use remote Traccar server
VITE_TRACCAR_URL=https://fleet.numz.site
VITE_APP_MODE=production
VITE_DEBUG=false
```

## 📝 Database Schema Requirements

### Vehicles Table
The `vehicles` table must include the following columns:
```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  model VARCHAR,  -- This column is required!
  type VARCHAR NOT NULL,
  registration_number VARCHAR,
  fuel_type VARCHAR,
  fuel_capacity DECIMAL,
  current_mileage DECIMAL,
  budget DECIMAL,
  driver_id UUID REFERENCES drivers(id),
  traccar_device_id VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🚨 Important Notes

1. **Never commit `.env.local`** - It contains sensitive information
2. **Always use `.env.example`** as a template for new developers
3. **Restart the development server** after changing environment variables
4. **Verify all required variables** are set before starting the application
5. **Check console logs** for environment validation messages

## 📞 Support

If you encounter issues with environment setup:
1. Check this documentation first
2. Verify all required environment variables are set
3. Check the browser console for error messages
4. Ensure all services (Supabase, Traccar) are accessible
5. Contact the development team with specific error messages

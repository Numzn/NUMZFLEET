# Quick Environment Setup

## 🚀 Immediate Fix for Current Issues

### Step 1: Create Environment File
Create a file named `.env.local` in the `client` directory with the following content:

```bash
# ===========================================
# SUPABASE CONFIGURATION
# ===========================================
VITE_SUPABASE_URL=https://yyqvediztsrlugentoca.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-supabase-anon-key-here

# ===========================================
# TRACCAR SERVER CONFIGURATION
# ===========================================
# Using remote server to avoid localhost:8082 issues
VITE_TRACCAR_URL=https://fleet.numz.site
VITE_TRACCAR_AUTH=bjVtZXJpbnl5aXJlbmRhMTRAZ21haWwuY29tOm51bXowMDk5

# ===========================================
# APPLICATION SETTINGS
# ===========================================
VITE_APP_MODE=development
VITE_API_TIMEOUT=10000
VITE_DEBUG=true
```

### Step 2: Update Supabase Key
Replace `your-actual-supabase-anon-key-here` with your real Supabase anon key from your project settings.

### Step 3: Fix Database Schema
Run this SQL in your Supabase SQL editor:

```sql
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model VARCHAR;
UPDATE vehicles SET model = 'Unknown' WHERE model IS NULL;
```

### Step 4: Restart Development Server
```bash
cd client
npm run dev
```

## ✅ This Will Fix:
1. ❌ Traccar connection refused → ✅ Uses remote server
2. ❌ Missing model column → ✅ Adds model column to database
3. ❌ Environment variables missing → ✅ Provides all required variables

## 📁 File Structure After Setup:
```
client/
├── .env.local          # Your environment file (DO NOT COMMIT)
├── .env.example        # Template for others (COMMIT THIS)
└── src/                # Your application code
```

## 🔒 Security Note:
- Never commit `.env.local` to version control
- Always use `.env.example` as a template for other developers
- Keep your Supabase anon key secure

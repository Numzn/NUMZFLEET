# Troubleshooting Guide

This guide helps resolve common issues with the Fleet Management Application.

## 🚨 Current Issues & Solutions

### Issue 1: Traccar Connection Refused
```
Error: GET http://localhost:8082/api/devices net::ERR_CONNECTION_REFUSED
```

**Root Cause:** The application is trying to connect to a local Traccar server that isn't running.

**Solutions:**

#### Option A: Use Remote Traccar Server (Recommended)
1. Create `client/.env.local` with:
```bash
VITE_TRACCAR_URL=https://fleet.numz.site
VITE_TRACCAR_AUTH=bjVtZXJpbnl5aXJlbmRhMTRAZ21haWwuY29tOm51bXowMDk5
```

#### Option B: Start Local Traccar Server
1. Download and install Traccar server
2. Start Traccar on port 8082
3. Configure authentication

#### Option C: Disable Traccar Features
1. Comment out Traccar-related code temporarily
2. Focus on Supabase functionality first

### Issue 2: Missing 'model' Column
```
Error: Could not find the 'model' column of 'vehicles' in the schema cache
```

**Root Cause:** The Supabase `vehicles` table is missing the `model` column.

**Solution:**
1. Run the SQL migration in your Supabase SQL editor:
```sql
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model VARCHAR;
UPDATE vehicles SET model = 'Unknown' WHERE model IS NULL;
```

2. Or use the provided migration file:
```bash
# Copy the contents of database-migration.sql to Supabase SQL editor
```

## 🔧 Environment Setup Issues

### Missing Environment Variables
```
Error: Missing Supabase environment variables
```

**Solution:**
1. Create `client/.env.local` file
2. Add required variables:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TRACCAR_URL=https://fleet.numz.site
VITE_TRACCAR_AUTH=base64-encoded-credentials
```

### Invalid Supabase Credentials
```
Error: Invalid API key
```

**Solution:**
1. Check Supabase project settings
2. Verify the anon key is correct
3. Ensure the project is active

## 🌐 Network Issues

### CORS Errors
```
Error: CORS policy blocks the request
```

**Solution:**
1. Check Supabase CORS settings
2. Verify domain is whitelisted
3. Use proper authentication headers

### Timeout Errors
```
Error: Request timeout
```

**Solution:**
1. Increase timeout in environment variables:
```bash
VITE_API_TIMEOUT=30000
```
2. Check network connectivity
3. Verify server is responding

## 🗄️ Database Issues

### Schema Mismatch
```
Error: Column does not exist
```

**Solution:**
1. Check database schema matches application expectations
2. Run migrations to update schema
3. Verify table structure in Supabase

### Permission Errors
```
Error: Insufficient privileges
```

**Solution:**
1. Check RLS (Row Level Security) policies
2. Verify user permissions
3. Update Supabase policies if needed

## 🚀 Development Server Issues

### Port Already in Use
```
Error: Port 5173 is already in use
```

**Solution:**
```bash
# Kill process using the port
npx kill-port 5173

# Or use a different port
npm run dev -- --port 3000
```

### Build Errors
```
Error: Module not found
```

**Solution:**
1. Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

2. Check import paths
3. Verify all dependencies are installed

## 🔍 Debugging Steps

### 1. Check Console Logs
- Open browser developer tools
- Look for error messages in console
- Check network tab for failed requests

### 2. Verify Environment Variables
```bash
# Check if variables are loaded
console.log(import.meta.env.VITE_SUPABASE_URL)
```

### 3. Test API Endpoints
```bash
# Test Supabase connection
curl -H "apikey: YOUR_ANON_KEY" https://your-project.supabase.co/rest/v1/vehicles

# Test Traccar connection
curl -H "Authorization: Basic YOUR_AUTH" https://fleet.numz.site/api/devices
```

### 4. Check Database Schema
```sql
-- Verify vehicles table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'vehicles';
```

## 📞 Getting Help

### Before Asking for Help
1. Check this troubleshooting guide
2. Verify all environment variables are set
3. Check browser console for specific error messages
4. Ensure all services are accessible

### When Reporting Issues
Include:
- Exact error message
- Browser console logs
- Environment configuration (without sensitive data)
- Steps to reproduce
- Expected vs actual behavior

### Quick Fixes
```bash
# Reset environment
rm client/.env.local
# Recreate with correct values

# Clear cache
npm run build
rm -rf dist
npm run dev

# Check dependencies
npm audit
npm update
```

## 🎯 Common Solutions Summary

| Issue | Quick Fix |
|-------|-----------|
| Traccar connection refused | Use `VITE_TRACCAR_URL=https://fleet.numz.site` |
| Missing model column | Run `ALTER TABLE vehicles ADD COLUMN model VARCHAR;` |
| Supabase connection failed | Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| Build errors | Run `npm install` and clear cache |
| Port conflicts | Use `npx kill-port 5173` or different port |

## 📚 Additional Resources

- [Environment Setup Guide](ENVIRONMENT-SETUP.md)
- [Supabase Documentation](https://supabase.com/docs)
- [Traccar Documentation](https://www.traccar.org/documentation/)
- [Vite Documentation](https://vitejs.dev/guide/)

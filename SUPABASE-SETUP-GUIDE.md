# NUMZFLEET Supabase Setup Guide

## ✅ Step 1: Environment Variables (COMPLETED)
Your `.env` file has been created in the `client` directory with:
```
VITE_SUPABASE_URL=https://yyqvediztsrlugentoca.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSvENKO3US3gHLp_RoYbZt5HOM
```

## 🔧 Step 2: Set Up Database Tables in Supabase

### Option A: Use Supabase Dashboard (Recommended)
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in and select your project: `yyqvediztsrlugentoca`
3. Go to **SQL Editor** in the left sidebar
4. Copy and paste the entire content of `supabase-schema.sql`
5. Click **Run** to execute the SQL

### Option B: Use Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref yyqvediztsrlugentoca

# Push the schema
supabase db push
```

## 🧪 Step 3: Test the Connection
1. The development server should be running (`npm run dev`)
2. Open your browser and go to the dashboard
3. You should see a **Supabase Connection Test** component at the top
4. It will show:
   - 🟡 **Testing...** - Initial connection test
   - 🟢 **Connected** - Successfully connected to Supabase
   - 🔴 **Error** - Connection failed (check credentials)

## 📊 Step 4: Create Sample Data (Optional)
Once connected, you can create sample data:

### Create a Driver
```sql
INSERT INTO drivers (name, license_number, phone_number, email) 
VALUES ('John Doe', 'DL123456', '+260123456789', 'john@example.com');
```

### Create a Vehicle
```sql
INSERT INTO vehicles (name, type, fuel_type, budget) 
VALUES ('Toyota Hilux', 'Pickup Truck', 'Diesel', 5000.00);
```

### Create a Fuel Record
```sql
INSERT INTO fuel_records (vehicle_id, session_date, fuel_amount, fuel_cost, current_mileage) 
VALUES (
  (SELECT id FROM vehicles WHERE name = 'Toyota Hilux' LIMIT 1),
  NOW(),
  50.00,
  150.00,
  15000.00
);
```

## 🔐 Step 5: Set Up Authentication (Optional)
If you want to use Supabase Auth:

1. Go to **Authentication > Settings** in Supabase dashboard
2. Configure your site URL and redirect URLs
3. Update the `AuthContext.tsx` to use Supabase Auth instead of placeholder

## 🚀 Step 6: Test Full Functionality
1. **Vehicle Management**: Add/edit/delete vehicles
2. **Driver Management**: Add/edit/delete drivers  
3. **Fuel Records**: Create and view fuel records
4. **Analytics**: View dashboard metrics and charts

## ❌ Troubleshooting

### Connection Failed
- Check your `.env` file exists in `client` directory
- Verify Supabase URL and key are correct
- Check if your Supabase project is active

### Tables Not Found
- Run the SQL schema in Supabase SQL Editor
- Check for any SQL errors in the execution

### Build Errors
- Restart the development server: `npm run dev`
- Clear browser cache
- Check browser console for errors

## 🎯 What's Working Now
- ✅ Environment variables configured
- ✅ Supabase client configured
- ✅ Connection test component added
- ✅ Development server running

## 🔄 Next Steps
1. **Test connection** - Check the dashboard for connection status
2. **Set up database** - Run the SQL schema in Supabase
3. **Verify functionality** - Test CRUD operations
4. **Deploy** - Use `npm run build` and deploy to Vercel

## 📞 Support
If you encounter issues:
1. Check the browser console for error messages
2. Verify Supabase project status
3. Check the connection test component status
4. Review the SQL schema execution logs

---

**Status**: 🟡 **Setup in Progress** - Environment configured, database setup needed


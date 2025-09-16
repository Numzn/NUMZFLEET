#!/usr/bin/env node

/**
 * Database Setup Script
 * This script helps set up the database tables and run migrations
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const envPath = join(__dirname, '..', 'client', 'env.local')
let envVars = {}

try {
  const envContent = readFileSync(envPath, 'utf8')
  envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, ...valueParts] = line.split('=')
    if (key && !key.startsWith('#')) {
      acc[key.trim()] = valueParts.join('=').trim()
    }
    return acc
  }, {})
} catch (error) {
  console.error('❌ Failed to load environment variables:', error.message)
  process.exit(1)
}

const supabaseUrl = envVars.VITE_SUPABASE_URL
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please check your client/env.local file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database...')
    
    // Test connection
    console.log('🔍 Testing connection...')
    const { data: testData, error: testError } = await supabase
      .from('admins')
      .select('count')
      .limit(1)
    
    if (testError) {
      if (testError.code === 'PGRST116') {
        console.log('❌ Tables do not exist. You need to run the migration first.')
        console.log('')
        console.log('To fix this:')
        console.log('1. Make sure you have Supabase CLI installed: npm install -g supabase')
        console.log('2. Link your project: supabase link --project-ref YOUR_PROJECT_REF')
        console.log('3. Run the migration: supabase db push')
        console.log('')
        console.log('Or manually create the tables using the SQL in supabase/migrations/001_initial_schema.sql')
        return false
      } else {
        console.error('❌ Database error:', testError)
        return false
      }
    }
    
    console.log('✅ Database connection successful')
    console.log('✅ Tables exist and are accessible')
    
    // Check if admin users exist
    const { data: admins, error: adminError } = await supabase
      .from('admins')
      .select('id, email, role')
      .limit(5)
    
    if (adminError) {
      console.error('❌ Failed to check admins:', adminError)
      return false
    }
    
    if (admins && admins.length > 0) {
      console.log('✅ Admin users found:')
      admins.forEach(admin => {
        console.log(`   - ${admin.email} (${admin.role})`)
      })
    } else {
      console.log('⚠️ No admin users found')
      console.log('You can create one by logging in through the app')
    }
    
    return true
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Database Setup Script')
  console.log('========================')
  console.log('')
  
  const success = await setupDatabase()
  
  if (success) {
    console.log('')
    console.log('✅ Database setup completed successfully!')
    console.log('You can now run the app and log in.')
  } else {
    console.log('')
    console.log('❌ Database setup failed. Please check the errors above.')
    process.exit(1)
  }
}

main().catch(console.error)















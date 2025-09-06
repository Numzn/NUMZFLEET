import { supabase } from './supabase'

export interface DatabaseSetupResult {
  success: boolean
  message: string
  details?: any
}

/**
 * Ensures the database is properly set up with required tables and policies
 */
export async function setupDatabase(): Promise<DatabaseSetupResult> {
  try {
    console.log('🔧 Setting up database...')
    
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('admins')
      .select('count')
      .limit(1)
    
    if (testError) {
      if (testError.code === 'PGRST116') {
        return {
          success: false,
          message: 'Database tables do not exist. Please run the migration first.',
          details: { error: testError }
        }
      } else if (testError.code === '42501') {
        return {
          success: false,
          message: 'Permission denied. RLS policies may be blocking access.',
          details: { error: testError }
        }
      } else {
        return {
          success: false,
          message: `Database connection failed: ${testError.message}`,
          details: { error: testError }
        }
      }
    }
    
    console.log('✅ Database connection successful')
    
    // Test all required tables
    const tables = ['vehicles', 'drivers', 'fuel_records', 'admins']
    const tableTests = await Promise.all(
      tables.map(async (table) => {
        const { data, error } = await supabase
          .from(table)
          .select('count')
          .limit(1)
        
        return { table, success: !error, error }
      })
    )
    
    const failedTables = tableTests.filter(test => !test.success)
    if (failedTables.length > 0) {
      return {
        success: false,
        message: `Some tables are not accessible: ${failedTables.map(t => t.table).join(', ')}`,
        details: { failedTables }
      }
    }
    
    console.log('✅ All database tables are accessible')
    
    return {
      success: true,
      message: 'Database is properly set up and accessible'
    }
    
  } catch (error) {
    console.error('❌ Database setup error:', error)
    return {
      success: false,
      message: `Database setup failed: ${error}`,
      details: { error }
    }
  }
}

/**
 * Creates a test admin user if none exist
 */
export async function createTestAdmin(): Promise<DatabaseSetupResult> {
  try {
    console.log('🔧 Creating test admin user...')
    
    // Check if any admins exist
    const { data: existingAdmins, error: checkError } = await supabase
      .from('admins')
      .select('id')
      .limit(1)
    
    if (checkError) {
      return {
        success: false,
        message: `Failed to check existing admins: ${checkError.message}`,
        details: { error: checkError }
      }
    }
    
    if (existingAdmins && existingAdmins.length > 0) {
      return {
        success: true,
        message: 'Admin users already exist'
      }
    }
    
    // Create test admin (this should be done through proper registration)
    console.log('⚠️ No admin users found. Please register through the login page.')
    
    return {
      success: false,
      message: 'No admin users found. Please register through the login page.',
      details: { needsRegistration: true }
    }
    
  } catch (error) {
    console.error('❌ Create test admin error:', error)
    return {
      success: false,
      message: `Failed to create test admin: ${error}`,
      details: { error }
    }
  }
}






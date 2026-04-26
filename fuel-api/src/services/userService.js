import mysql from 'mysql2/promise';
import { authConfig } from '../config/auth.config.js';

/**
 * User Service
 * Handles lookups and validation against Traccar MySQL
 */

let traccarPool = null;

/**
 * Get Traccar MySQL connection pool
 */
const getTraccarPool = () => {
  if (!traccarPool) {
    traccarPool = mysql.createPool({
      host: authConfig.TRACCAR.MYSQL_HOST,
      port: authConfig.TRACCAR.MYSQL_PORT,
      database: authConfig.TRACCAR.MYSQL_DATABASE,
      user: authConfig.TRACCAR.MYSQL_USER,
      password: authConfig.TRACCAR.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return traccarPool;
};

/**
 * Test Traccar MySQL connection on startup
 */
export const testTraccarConnection = async () => {
  try {
    const pool = getTraccarPool();
    const [rows] = await pool.execute('SELECT 1 as test');
    console.log('✅ Traccar MySQL connection established');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to Traccar MySQL:', error.message);
    return false;
  }
};

/**
 * Get user by ID from Traccar database
 */
export const getTraccarUser = async (userId) => {
  try {
    const pool = getTraccarPool();
    const [rows] = await pool.execute(
      'SELECT id, name, email, administrator, readonly, disabled FROM tc_users WHERE id = ? AND disabled = 0',
      [userId]
    );
    
    if (rows.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      administrator: rows[0].administrator,
      readonly: rows[0].readonly,
      isManager: rows[0].administrator,
      isDriver: !rows[0].administrator,
    };
  } catch (error) {
    console.error('Error getting Traccar user:', error);
    throw error;
  }
};

/**
 * Get user by session token (JSESSIONID)
 */
export const getTraccarUserBySessionToken = async (sessionToken) => {
  try {
    if (!sessionToken) {
      throw new Error('No session token provided');
    }
    
    const pool = getTraccarPool();
    
    // Approach 1: Check if session token is a user ID (for testing)
    if (/^\d+$/.test(sessionToken)) {
      const userId = parseInt(sessionToken);
      return await getTraccarUser(userId);
    }
    
    // Approach 2: Query tc_user_sessions table
    try {
      const [sessionRows] = await pool.execute(
        'SELECT userid FROM tc_user_sessions WHERE id = ? LIMIT 1',
        [sessionToken]
      );
      
      if (sessionRows.length > 0) {
        return await getTraccarUser(sessionRows[0].userid);
      }
    } catch (sessionError) {
      if (authConfig.LOG_AUTH) {
        console.log('Session table query failed:', sessionError.message);
      }
    }
    
    // No valid session found
    throw new Error(`Session token not found or invalid`);
  } catch (error) {
    console.error('Error getting Traccar user by session token:', error);
    throw error;
  }
};

/**
 * Get user by validating session with Traccar API
 * More reliable than MySQL (uses Traccar's native validation)
 */
export const getTraccarUserBySessionViaAPI = async (
  sessionToken,
  traccarBaseUrl = authConfig.TRACCAR.API_URL
) => {
  try {
    const url = `${traccarBaseUrl}/api/session`;
    
    if (authConfig.LOG_AUTH) {
      console.log(`Validating session with Traccar API: ${url}`);
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': `JSESSIONID=${sessionToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Traccar session validation failed: ${response.status} ${response.statusText}`);
    }
    
    const user = await response.json();
    
    // Normalize response
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      administrator: user.administrator,
      readonly: user.readonly,
      isManager: user.administrator,
      isDriver: !user.administrator,
    };
  } catch (error) {
    console.error('Error validating session with Traccar API:', error);
    throw error;
  }
};

/**
 * Get device by ID from Traccar
 */
export const getTraccarDevice = async (deviceId) => {
  try {
    const pool = getTraccarPool();
    const [rows] = await pool.execute(
      'SELECT id, name, uniqueid, status, lastupdate, positionid FROM tc_devices WHERE id = ?',
      [deviceId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0];
  } catch (error) {
    console.error('Error getting Traccar device:', error);
    throw error;
  }
};

export default {
  getTraccarUser,
  getTraccarUserBySessionToken,
  getTraccarUserBySessionViaAPI,
  getTraccarDevice,
  testTraccarConnection,
};

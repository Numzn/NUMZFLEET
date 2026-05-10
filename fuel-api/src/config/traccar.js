import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Traccar MySQL connection configuration
const traccarConfig = {
  host: process.env.TRACCAR_MYSQL_HOST || 'traccar-mysql',
  port: parseInt(process.env.TRACCAR_MYSQL_PORT || '3306'),
  database: process.env.TRACCAR_MYSQL_DATABASE || process.env.MYSQL_DATABASE || 'traccar',
  user: process.env.TRACCAR_MYSQL_USER || process.env.MYSQL_USER || 'traccar',
  password: process.env.TRACCAR_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || 'traccar123',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
let traccarPool = null;

/**
 * Get Traccar MySQL connection pool
 */
const getTraccarPool = () => {
  if (!traccarPool) {
    traccarPool = mysql.createPool(traccarConfig);
  }
  return traccarPool;
};

/**
 * Test Traccar MySQL connection
 */
export const testTraccarConnection = async () => {
  try {
    const pool = getTraccarPool();
    const [rows] = await pool.execute('SELECT 1 as test');
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Traccar MySQL connection established successfully');
    }
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
    
    return rows[0];
  } catch (error) {
    console.error('Error getting Traccar user:', error);
    throw error;
  }
};

/**
 * Get user by email from Traccar database
 */
export const getTraccarUserByEmail = async (email) => {
  try {
    const pool = getTraccarPool();
    const [rows] = await pool.execute(
      'SELECT id, name, email, administrator, readonly, disabled FROM tc_users WHERE email = ? AND disabled = 0',
      [email]
    );
    
    if (rows.length === 0) {
      throw new Error(`User with email ${email} not found`);
    }
    
    return rows[0];
  } catch (error) {
    console.error('Error getting Traccar user by email:', error);
    throw error;
  }
};

/**
 * Get user by session token (JSESSIONID)
 * Traccar stores sessions in tc_user_sessions table
 */
export const getTraccarUserBySessionToken = async (sessionToken) => {
  try {
    const pool = getTraccarPool();
    
    // Traccar stores sessions - we need to find the user ID from the session
    // The session token format can vary, so we'll try multiple approaches
    
    // Approach 1: Check if session token is a user ID (for development/testing)
    // Some setups use user ID directly as session token
    if (/^\d+$/.test(sessionToken)) {
      const userId = parseInt(sessionToken);
      return await getTraccarUser(userId);
    }
    
    // Approach 2: Query tc_user_sessions table if it exists
    // Note: Traccar's session storage may vary by version
    try {
      const [sessionRows] = await pool.execute(
        'SELECT userid FROM tc_user_sessions WHERE id = ? LIMIT 1',
        [sessionToken]
      );
      
      if (sessionRows.length > 0) {
        return await getTraccarUser(sessionRows[0].userid);
      }
    } catch (sessionError) {
      // Table might not exist or have different structure
      if (process.env.NODE_ENV === 'development') {
        console.log('Session table query failed, trying alternative method:', sessionError.message);
      }
    }
    
    // Approach 3: For Traccar, we can also validate by making an API call to Traccar
    // But for now, we'll use a fallback: try to get user from Traccar API
    // This requires the session to be valid in Traccar
    
    // For now, if we can't find the session, throw an error
    throw new Error(`Session token ${sessionToken} not found or invalid`);
  } catch (error) {
    // Only log as error if it's not a "not found" error, to reduce noise
    if (process.env.NODE_ENV === 'development' && !error.message.includes('not found')) {
      console.error('Error getting Traccar user by session token:', error);
    }
    throw error;
  }
};

/**
 * Alternative: Get user by validating session with Traccar API
 * This is more reliable as it uses Traccar's own session validation
 */
export const getTraccarUserBySessionViaAPI = async (sessionToken, traccarBaseUrl = 'http://traccar:8082') => {
  try {
    // Make request to Traccar API to validate session
    const response = await fetch(`${traccarBaseUrl}/api/session`, {
      method: 'GET',
      headers: {
        'Cookie': `JSESSIONID=${sessionToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Traccar session validation failed: ${response.status}`);
    }
    
    const user = await response.json();
    return user;
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

/**
 * Upsert one attribute key on tc_devices.attributes JSON.
 * If value is null/undefined/empty, the key is removed.
 */
export const upsertTraccarDeviceAttribute = async (deviceId, key, value) => {
  const pool = getTraccarPool();
  const [rows] = await pool.execute(
    'SELECT attributes FROM tc_devices WHERE id = ? LIMIT 1',
    [deviceId],
  );

  if (!rows.length) {
    return false;
  }

  let attrs = {};
  const raw = rows[0].attributes;
  if (raw && typeof raw === 'string') {
    try {
      attrs = JSON.parse(raw);
      if (!attrs || Array.isArray(attrs) || typeof attrs !== 'object') {
        attrs = {};
      }
    } catch {
      attrs = {};
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    attrs = { ...raw };
  }

  if (value === null || value === undefined || value === '') {
    delete attrs[key];
  } else {
    attrs[key] = value;
  }

  await pool.execute(
    'UPDATE tc_devices SET attributes = ? WHERE id = ?',
    [JSON.stringify(attrs), deviceId],
  );

  return true;
};

/**
 * Get latest position for a device
 */
export const getTraccarPosition = async (deviceId) => {
  try {
    const pool = getTraccarPool();
    const [rows] = await pool.execute(
      `SELECT p.*, d.positionid 
       FROM tc_devices d
       LEFT JOIN tc_positions p ON d.positionid = p.id
       WHERE d.id = ?
       ORDER BY p.fixtime DESC
       LIMIT 1`,
      [deviceId]
    );
    
    if (rows.length === 0 || !rows[0].id) {
      return null;
    }
    
    // Parse attributes JSON if it exists
    const position = rows[0];
    if (position.attributes && typeof position.attributes === 'string') {
      try {
        position.attributes = JSON.parse(position.attributes);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }
    
    return position;
  } catch (error) {
    console.error('Error getting Traccar position:', error);
    throw error;
  }
};

const parsePositionAttributes = (position) => {
  if (!position?.attributes) return;
  if (typeof position.attributes === 'string') {
    try {
      position.attributes = JSON.parse(position.attributes);
    } catch {
      /* keep string */
    }
  }
};

/**
 * Batch-load Traccar devices by integer id (tc_devices.id).
 * @param {number[]} ids
 * @returns {Promise<object[]>}
 */
const parseDeviceRowAttributes = (row) => {
  if (!row?.attributes) return;
  if (typeof row.attributes === 'string') {
    try {
      row.attributes = JSON.parse(row.attributes);
    } catch {
      /* keep string */
    }
  }
};

export const getTraccarDevicesByIds = async (ids) => {
  if (!ids?.length) return [];
  const unique = [...new Set(ids.filter((id) => id != null && Number.isFinite(Number(id))).map(Number))];
  if (!unique.length) return [];
  const pool = getTraccarPool();
  const placeholders = unique.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id, name, uniqueid, status, lastupdate, positionid, attributes FROM tc_devices WHERE id IN (${placeholders})`,
    unique,
  );
  rows.forEach((row) => parseDeviceRowAttributes(row));
  return rows;
};

/**
 * Latest position per device using tc_devices.positionid (same semantics as getTraccarPosition).
 * Returns rows with numeric deviceId for stable Map keys in fuel-api services.
 * @param {number[]} ids
 * @returns {Promise<object[]>}
 */
export const getTraccarLatestPositionsByDeviceIds = async (ids) => {
  if (!ids?.length) return [];
  const unique = [...new Set(ids.filter((id) => id != null && Number.isFinite(Number(id))).map(Number))];
  if (!unique.length) return [];
  const pool = getTraccarPool();
  const placeholders = unique.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT d.id AS deviceId, p.id, p.latitude, p.longitude, p.speed, p.course, p.altitude, p.fixtime, p.attributes
     FROM tc_devices d
     LEFT JOIN tc_positions p ON d.positionid = p.id
     WHERE d.id IN (${placeholders})`,
    unique,
  );
  rows.forEach((row) => parsePositionAttributes(row));
  return rows;
};

/**
 * Get device attributes (fuel level, etc.)
 */
export const getDeviceAttributes = async (deviceId) => {
  try {
    const position = await getTraccarPosition(deviceId);
    return position?.attributes || {};
  } catch (error) {
    console.error('Error getting device attributes:', error);
    return {};
  }
};

/**
 * Close Traccar connection pool
 */
export const closeTraccarConnection = async () => {
  if (traccarPool) {
    await traccarPool.end();
    traccarPool = null;
  }
};

export default {
  getTraccarPool,
  testTraccarConnection,
  getTraccarUser,
  getTraccarUserByEmail,
  getTraccarUserBySessionToken,
  getTraccarUserBySessionViaAPI,
  getTraccarDevice,
  upsertTraccarDeviceAttribute,
  getTraccarPosition,
  getTraccarDevicesByIds,
  getTraccarLatestPositionsByDeviceIds,
  getDeviceAttributes,
  closeTraccarConnection,
};


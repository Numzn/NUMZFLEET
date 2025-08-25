// Enhanced Traccar API Client with Type Safety
import { TraccarDevice, TraccarPosition } from '@shared/schema';

// Environment-based configuration
const TRACCAR_BASE_URL = import.meta.env.VITE_TRACCAR_URL || 'http://localhost:8082';
// Convert email:password to base64 for Basic Auth
const TRACCAR_AUTH = import.meta.env.VITE_TRACCAR_AUTH || btoa('numerinyirenda14@gmail.com:numz0099');

// Connection timeout settings
const CONNECTION_TIMEOUT = 10000; // 10 seconds timeout

// Traccar API endpoints
export const traccarEndpoints = {
  devices: `${TRACCAR_BASE_URL}/api/devices`,
  positions: `${TRACCAR_BASE_URL}/api/positions`,
  reports: `${TRACCAR_BASE_URL}/api/reports`,
  users: `${TRACCAR_BASE_URL}/api/users`,
} as const;

console.log('🌐 Traccar Configuration:', {
  TRACCAR_BASE_URL,
  TRACCAR_AUTH: '***',
  MODE: 'REAL_TRACCAR_API_ONLY'
});

// Enhanced Traccar API Client
export class TraccarClient {
  // Get all devices
  static async getDevices(): Promise<TraccarDevice[]> {
    try {
      console.log('🌐 TraccarClient.getDevices: Connecting to Traccar server at', traccarEndpoints.devices);
      const response = await fetch(traccarEndpoints.devices, {
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
      }

      const devices = await response.json();
      console.log(`✅ Successfully fetched ${devices.length} devices from Traccar`);
      return devices.map((device: any) => ({
        ...device,
        status: device.status || 'offline',
        lastUpdate: device.lastUpdate || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('❌ Error fetching Traccar devices:', error);
      throw new Error(`Failed to fetch devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get device positions
  static async getPositions(deviceId?: number): Promise<TraccarPosition[]> {
    try {
      const url = deviceId 
        ? `${traccarEndpoints.positions}?deviceId=${deviceId}`
        : traccarEndpoints.positions;

      console.log(`🌐 TraccarClient.getPositions: Fetching positions from ${url}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
      }

      const positions = await response.json();
      console.log(`✅ Successfully fetched ${positions.length} positions from Traccar`);
      return positions;
    } catch (error) {
      console.error('❌ Error fetching Traccar positions:', error);
      throw new Error(`Failed to fetch positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get latest position for a specific device
  static async getLatestPosition(deviceId: number): Promise<TraccarPosition | null> {
    try {
      const positions = await this.getPositions(deviceId);
      if (positions.length === 0) return null;
      
      // Sort by server time and return the latest
      return positions.sort((a, b) => 
        new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime()
      )[0];
    } catch (error) {
      console.error(`Error fetching latest position for device ${deviceId}:`, error);
      return null;
    }
  }

  // Get specific device
  static async getDevice(deviceId: number): Promise<TraccarDevice> {
    try {
      const response = await fetch(`${traccarEndpoints.devices}/${deviceId}`, {
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
      }

      const device = await response.json();
      return {
        ...device,
        status: device.status || 'offline',
        lastUpdate: device.lastUpdate || new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error fetching Traccar device ${deviceId}:`, error);
      throw new Error(`Failed to fetch device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Test connection
  static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(traccarEndpoints.devices, {
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // Shorter timeout for connection test
      });
      return response.ok;
    } catch (error) {
      console.error('Traccar connection test failed:', error);
      return false;
    }
  }

  // Get device count
  static async getDeviceCount(): Promise<number> {
    try {
      const devices = await this.getDevices();
      return devices.length;
    } catch (error) {
      console.error('Error getting device count:', error);
      return 0;
    }
  }

  // Get online device count
  static async getOnlineDeviceCount(): Promise<number> {
    try {
      const devices = await this.getDevices();
      return devices.filter(device => device.status === 'online').length;
    } catch (error) {
      console.error('Error getting online device count:', error);
      return 0;
    }
  }
}

// Debug logging
console.log('🌐 Traccar Configuration:', {
  TRACCAR_BASE_URL,
  TRACCAR_AUTH: '***',
  MODE: 'REAL_TRACCAR_API_ONLY'
});

// Production API functions - only real Traccar data
export const traccarApi = {
  // Get all devices
  async getDevices(): Promise<TraccarDevice[]> {
    return TraccarClient.getDevices();
  },

  // Get device positions
  async getPositions(deviceId?: number): Promise<TraccarPosition[]> {
    return TraccarClient.getPositions(deviceId);
  },

  // Get specific device
  async getDevice(deviceId: number): Promise<TraccarDevice> {
    return TraccarClient.getDevice(deviceId);
  },

  // Test connection
  async testConnection(): Promise<boolean> {
    return TraccarClient.testConnection();
  },
}; 
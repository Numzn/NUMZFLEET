// Enhanced Traccar API Client with Type Safety
import { TraccarDevice, TraccarPosition } from '@shared/schema';
import { optimizeCoordinates } from '@/utils/optimization';
import { OptimizationOptions } from '@/types/optimization';

// Environment-based configuration - AWS Hosted Traccar
const TRACCAR_BASE_URL = import.meta.env.VITE_TRACCAR_URL || 'https://fleet.numz.site';
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


// Enhanced Traccar API Client
export class TraccarClient {
  // Get all devices
  static async getDevices(): Promise<TraccarDevice[]> {
    try {
      
      const response = await fetch(traccarEndpoints.devices, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit', // Don't send cookies, use Basic Auth only
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });


      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Traccar API error response:', errorText);
        throw new Error(`Traccar API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const devices = await response.json();
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

  // Get device positions - using correct positions endpoint
  static async getPositions(deviceId?: number | any): Promise<TraccarPosition[]> {
    try {
      // Handle case where deviceId might be an object or invalid
      let validDeviceId: number | undefined;
      if (typeof deviceId === 'number' && deviceId > 0) {
        validDeviceId = deviceId;
      } else if (deviceId && typeof deviceId === 'object' && deviceId.id) {
        validDeviceId = deviceId.id;
      }

      const url = validDeviceId 
        ? `${traccarEndpoints.positions}?deviceId=${validDeviceId}`
        : traccarEndpoints.positions;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit', // Don't send cookies, use Basic Auth only
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
      }

      const positions = await response.json();
      
      
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
        method: 'GET',
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit', // Don't send cookies, use Basic Auth only
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
        method: 'GET',
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit', // Don't send cookies, use Basic Auth only
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

  // Get optimized positions for a device
  static async getOptimizedPositions(
    deviceId?: number | any, 
    options: OptimizationOptions = {}
  ): Promise<{
    positions: TraccarPosition[];
    optimization: {
      originalCount: number;
      optimizedCount: number;
      reductionPercentage: number;
      statistics: any;
    };
  }> {
    try {
      // Get raw positions first
      const rawPositions = await this.getPositions(deviceId);
      
      if (rawPositions.length === 0) {
        return {
          positions: [],
          optimization: {
            originalCount: 0,
            optimizedCount: 0,
            reductionPercentage: 0,
            statistics: {}
          }
        };
      }

      // Apply optimization
      const optimizationResult = optimizeCoordinates(rawPositions, options);
      

      return {
        positions: optimizationResult.optimizedPositions,
        optimization: {
          originalCount: optimizationResult.originalCount,
          optimizedCount: optimizationResult.optimizedCount,
          reductionPercentage: optimizationResult.reductionPercentage,
          statistics: optimizationResult.statistics
        }
      };
    } catch (error) {
      console.error('❌ Error getting optimized positions:', error);
      throw new Error(`Failed to get optimized positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Debug logging

// Production API functions - only real Traccar data
export const traccarApi = {
  // Get all devices
  async getDevices(): Promise<TraccarDevice[]> {
    return TraccarClient.getDevices();
  },

  // Get device positions
  async getPositions(deviceId?: number | any): Promise<TraccarPosition[]> {
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

  // Get optimized positions
  async getOptimizedPositions(deviceId?: number | any, options?: OptimizationOptions) {
    return TraccarClient.getOptimizedPositions(deviceId, options);
  },
}; 

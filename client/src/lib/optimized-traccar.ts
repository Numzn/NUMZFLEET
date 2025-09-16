// Optimized Traccar API Client with Coordinate Optimization
import { TraccarDevice, TraccarPosition } from '@shared/schema';

// Environment-based configuration
const OPTIMIZATION_SERVICE_URL = import.meta.env.VITE_OPTIMIZATION_SERVICE_URL || 'http://localhost:3001';
const TRACCAR_BASE_URL = import.meta.env.VITE_TRACCAR_URL || 'https://fleet.numz.site';
const TRACCAR_AUTH = import.meta.env.VITE_TRACCAR_AUTH || btoa('numerinyirenda14@gmail.com:numz0099');

// Connection timeout settings
const CONNECTION_TIMEOUT = 15000; // 15 seconds for optimization service

  OPTIMIZATION_SERVICE_URL,
  TRACCAR_BASE_URL,
  MODE: 'OPTIMIZED_WITH_MIDDLEWARE'
});

// Optimization options interface
export interface OptimizationOptions {
  tolerance?: number; // meters
  minSpeed?: number; // km/h
  minTimeInterval?: number; // milliseconds
  maxSpeed?: number; // km/h
  minAccuracy?: number; // meters
  preserveStops?: boolean;
  preserveSpeedChanges?: boolean;
  enableTimeFilter?: boolean;
  enableSpeedFilter?: boolean;
  enableAccuracyFilter?: boolean;
}

// Optimization result interface
export interface OptimizationResult {
  originalCount: number;
  optimizedCount: number;
  reductionPercentage: number;
  statistics: {
    accuracyFiltered: number;
    speedFiltered: number;
    timeFiltered: number;
    douglasPeuckerReduced: number;
  };
  options: OptimizationOptions;
}

// Enhanced position interface with optimization data
export interface OptimizedPosition extends TraccarPosition {
  optimization?: {
    isOptimized: boolean;
    originalIndex?: number;
    keptReason?: string;
  };
}

// Optimized Traccar API Client
export class OptimizedTraccarClient {
  // Check if optimization service is available
  static async isOptimizationServiceAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${OPTIMIZATION_SERVICE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.warn('⚠️ Optimization service not available, falling back to direct Traccar API');
      return false;
    }
  }

  // Get all devices (no optimization needed)
  static async getDevices(): Promise<TraccarDevice[]> {
    try {
      const isOptimizedAvailable = await this.isOptimizationServiceAvailable();
      
      if (isOptimizedAvailable) {
        const response = await fetch(`${OPTIMIZATION_SERVICE_URL}/api/devices`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
        });

        if (response.ok) {
          const devices = await response.json();
          return devices;
        }
      }

      // Fallback to direct Traccar API
      const response = await fetch(`${TRACCAR_BASE_URL}/api/devices`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
      }

      const devices = await response.json();
      return devices.map((device: any) => ({
        ...device,
        status: device.status || 'offline',
        lastUpdate: device.lastUpdate || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('❌ Error fetching devices:', error);
      throw new Error(`Failed to fetch devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get optimized positions for a device
  static async getOptimizedPositions(
    deviceId: number, 
    options: OptimizationOptions = {}
  ): Promise<{
    positions: OptimizedPosition[];
    optimization: OptimizationResult;
  }> {
    try {
      const isOptimizedAvailable = await this.isOptimizationServiceAvailable();
      
      if (isOptimizedAvailable) {
        
        const queryParams = new URLSearchParams({
          deviceId: deviceId.toString(),
          optimize: 'true',
          tolerance: (options.tolerance || 10).toString(),
          minSpeed: (options.minSpeed || 5).toString(),
          minTimeInterval: (options.minTimeInterval || 30000).toString(),
          maxSpeed: (options.maxSpeed || 200).toString(),
          minAccuracy: (options.minAccuracy || 100).toString(),
          preserveStops: (options.preserveStops !== false).toString(),
          preserveSpeedChanges: (options.preserveSpeedChanges !== false).toString()
        });

        const response = await fetch(`${OPTIMIZATION_SERVICE_URL}/api/positions?${queryParams}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
        });

        if (response.ok) {
          const result = await response.json();
          return result;
        }
      }

      // Fallback to direct Traccar API
      const response = await fetch(`${TRACCAR_BASE_URL}/api/positions?deviceId=${deviceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
      }

      const positions = await response.json();
      
      return {
        positions: positions.map((pos: any) => ({ ...pos, optimization: { isOptimized: false } })),
        optimization: {
          originalCount: positions.length,
          optimizedCount: positions.length,
          reductionPercentage: 0,
          statistics: {
            accuracyFiltered: 0,
            speedFiltered: 0,
            timeFiltered: 0,
            douglasPeuckerReduced: 0
          },
          options: options
        }
      };
    } catch (error) {
      console.error('❌ Error fetching optimized positions:', error);
      throw new Error(`Failed to fetch positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get optimized historical positions
  static async getOptimizedHistoricalPositions(
    deviceId: number,
    from: Date,
    to: Date,
    options: OptimizationOptions = {}
  ): Promise<{
    positions: OptimizedPosition[];
    optimization: OptimizationResult;
  }> {
    try {
      const isOptimizedAvailable = await this.isOptimizationServiceAvailable();
      
      if (isOptimizedAvailable) {
        
        const queryParams = new URLSearchParams({
          deviceId: deviceId.toString(),
          from: from.toISOString(),
          to: to.toISOString(),
          limit: '1000',
          tolerance: (options.tolerance || 10).toString(),
          minSpeed: (options.minSpeed || 5).toString(),
          minTimeInterval: (options.minTimeInterval || 30000).toString(),
          maxSpeed: (options.maxSpeed || 200).toString(),
          minAccuracy: (options.minAccuracy || 100).toString(),
          preserveStops: (options.preserveStops !== false).toString(),
          preserveSpeedChanges: (options.preserveSpeedChanges !== false).toString()
        });

        const response = await fetch(`${OPTIMIZATION_SERVICE_URL}/api/history?${queryParams}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
        });

        if (response.ok) {
          const result = await response.json();
          return result;
        }
      }

      // Fallback to direct Traccar API
      const response = await fetch(`${TRACCAR_BASE_URL}/api/reports/route?deviceId=${deviceId}&from=${from.toISOString()}&to=${to.toISOString()}&limit=1000`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${TRACCAR_AUTH}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'omit',
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
      }

      const positions = await response.json();
      
      return {
        positions: positions.map((pos: any) => ({ ...pos, optimization: { isOptimized: false } })),
        optimization: {
          originalCount: positions.length,
          optimizedCount: positions.length,
          reductionPercentage: 0,
          statistics: {
            accuracyFiltered: 0,
            speedFiltered: 0,
            timeFiltered: 0,
            douglasPeuckerReduced: 0
          },
          options: options
        }
      };
    } catch (error) {
      console.error('❌ Error fetching optimized historical positions:', error);
      throw new Error(`Failed to fetch historical positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get optimization statistics for a device
  static async getOptimizationStats(
    deviceId: number,
    days: number = 7
  ): Promise<{
    deviceId: number;
    period: {
      from: string;
      to: string;
    };
    totalPositions: number;
    optimizationPotential: {
      withTolerance10: number;
      withTolerance25: number;
      withTolerance50: number;
    };
    recommendations: {
      recommendedTolerance: number;
      estimatedBandwidthSavings: number;
      estimatedStorageSavings: number;
    };
  }> {
    try {
      const isOptimizedAvailable = await this.isOptimizationServiceAvailable();
      
      if (isOptimizedAvailable) {
        const response = await fetch(`${OPTIMIZATION_SERVICE_URL}/api/optimization-stats/${deviceId}?days=${days}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
        });

        if (response.ok) {
          const stats = await response.json();
          return stats;
        }
      }

      // Fallback - return default stats
      return {
        deviceId,
        period: {
          from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString()
        },
        totalPositions: 0,
        optimizationPotential: {
          withTolerance10: 0,
          withTolerance25: 0,
          withTolerance50: 0
        },
        recommendations: {
          recommendedTolerance: 10,
          estimatedBandwidthSavings: 0,
          estimatedStorageSavings: 0
        }
      };
    } catch (error) {
      console.error('❌ Error fetching optimization stats:', error);
      throw new Error(`Failed to fetch optimization stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Test connection to optimization service
  static async testOptimizationService(): Promise<boolean> {
    try {
      const response = await fetch(`${OPTIMIZATION_SERVICE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Optimization service connection test failed:', error);
      return false;
    }
  }
}

// Production API functions with optimization
export const optimizedTraccarApi = {
  // Get all devices
  async getDevices(): Promise<TraccarDevice[]> {
    return OptimizedTraccarClient.getDevices();
  },

  // Get optimized positions
  async getOptimizedPositions(deviceId: number, options?: OptimizationOptions) {
    return OptimizedTraccarClient.getOptimizedPositions(deviceId, options);
  },

  // Get optimized historical positions
  async getOptimizedHistoricalPositions(deviceId: number, from: Date, to: Date, options?: OptimizationOptions) {
    return OptimizedTraccarClient.getOptimizedHistoricalPositions(deviceId, from, to, options);
  },

  // Get optimization statistics
  async getOptimizationStats(deviceId: number, days?: number) {
    return OptimizedTraccarClient.getOptimizationStats(deviceId, days);
  },

  // Test optimization service
  async testOptimizationService(): Promise<boolean> {
    return OptimizedTraccarClient.testOptimizationService();
  }
};



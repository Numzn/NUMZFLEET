// Historical Data API for Replay Feature
import { TraccarPosition } from '@shared/schema';

// Extended position interface for replay with additional attributes
export interface HistoricalPosition extends TraccarPosition {
  fuelLevel?: number;
  harshAcceleration?: boolean;
  harshBraking?: boolean;
  engineHours?: number;
  odometer?: number;
  attributes?: {
    fuelLevel?: number;
    harshAcceleration?: boolean;
    harshBraking?: boolean;
    engineHours?: number;
    odometer?: number;
    [key: string]: any;
  };
}

// Environment-based configuration
const TRACCAR_BASE_URL = import.meta.env.VITE_TRACCAR_URL || 'https://fleet.numz.site';
const TRACCAR_AUTH = import.meta.env.VITE_TRACCAR_AUTH || btoa('numerinyirenda14@gmail.com:numz0099');
const CONNECTION_TIMEOUT = 15000; // 15 seconds for historical data

export class HistoryApiClient {
  // Get historical positions with date range filtering
  static async getHistoricalPositions(
    deviceId: number, 
    from: Date, 
    to: Date,
    limit: number = 1000
  ): Promise<HistoricalPosition[]> {
    try {
      
      // Try multiple endpoints for historical data
      let rawPositions: any[] = [];
      
      // First, try the reports/route endpoint
      try {
        const routeUrl = `${TRACCAR_BASE_URL}/api/reports/route?deviceId=${deviceId}&from=${from.toISOString()}&to=${to.toISOString()}&limit=${limit}`;
        
        const routeResponse = await fetch(routeUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${TRACCAR_AUTH}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'omit',
          signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
        });

        if (routeResponse.ok) {
          rawPositions = await routeResponse.json();
        } else {
        }
      } catch (routeError) {
      }

      // If route endpoint failed or returned no data, try the positions endpoint
      if (rawPositions.length === 0) {
        try {
          const positionsUrl = `${TRACCAR_BASE_URL}/api/positions?deviceId=${deviceId}`;
          
          const positionsResponse = await fetch(positionsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${TRACCAR_AUTH}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            credentials: 'omit',
            signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
          });

          if (positionsResponse.ok) {
            const allPositions = await positionsResponse.json();
            // Filter positions by date range
            rawPositions = allPositions.filter((pos: any) => {
              const posTime = new Date(pos.deviceTime || pos.serverTime);
              return posTime >= from && posTime <= to;
            });
          } else {
          }
        } catch (positionsError) {
        }
      }

      // If still no data, try without date filtering
      if (rawPositions.length === 0) {
        try {
          const positionsUrl = `${TRACCAR_BASE_URL}/api/positions?deviceId=${deviceId}`;
          
          const positionsResponse = await fetch(positionsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${TRACCAR_AUTH}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            credentials: 'omit',
            signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
          });

          if (positionsResponse.ok) {
            rawPositions = await positionsResponse.json();
          }
        } catch (positionsError) {
        }
      }

      if (rawPositions.length === 0) {
        return [];
      }

      // Process and enrich position data
      const enrichedPositions: HistoricalPosition[] = rawPositions.map((pos: any) => {
        // Extract fuel and other attributes from the position data
        const attributes = pos.attributes || {};
        
        return {
          id: pos.id,
          deviceId: pos.deviceId,
          protocol: pos.protocol || 'unknown',
          serverTime: pos.serverTime,
          deviceTime: pos.deviceTime,
          fixTime: pos.fixTime,
          latitude: pos.latitude,
          longitude: pos.longitude,
          altitude: pos.altitude || 0,
          speed: pos.speed || 0,
          course: pos.course || 0,
          address: pos.address,
          accuracy: pos.accuracy,
          network: pos.network,
          // Enriched attributes for replay analysis
          fuelLevel: attributes.fuelLevel || attributes.fuel || null,
          harshAcceleration: attributes.harshAcceleration || false,
          harshBraking: attributes.harshBraking || false,
          engineHours: attributes.engineHours || null,
          odometer: attributes.odometer || null,
          attributes: attributes
        };
      });

      // Sort by timestamp to ensure chronological order
      enrichedPositions.sort((a, b) => 
        new Date(a.deviceTime).getTime() - new Date(b.deviceTime).getTime()
      );

      // Debug fuel data availability
      const positionsWithFuel = enrichedPositions.filter(pos => pos.fuelLevel !== null && pos.fuelLevel !== undefined);

      if (positionsWithFuel.length > 0) {
        // Fuel data is available for analysis
      }

      return enrichedPositions;
    } catch (error) {
      console.error('❌ Error fetching historical positions:', error);
      throw new Error(`Failed to fetch historical data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get positions for a specific day
  static async getDailyPositions(deviceId: number, date: Date): Promise<HistoricalPosition[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.getHistoricalPositions(deviceId, startOfDay, endOfDay);
  }

  // Get positions for the last N days
  static async getRecentPositions(deviceId: number, days: number = 7): Promise<HistoricalPosition[]> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    return this.getHistoricalPositions(deviceId, from, to);
  }

  // Get fuel consumption summary for a date range
  static async getFuelConsumptionSummary(
    deviceId: number, 
    from: Date, 
    to: Date
  ): Promise<{
    totalFuelUsed: number;
    averageFuelLevel: number;
    refuelEvents: number;
    fuelEfficiency: number; // km per liter
  }> {
    const positions = await this.getHistoricalPositions(deviceId, from, to);
    const positionsWithFuel = positions.filter(pos => pos.fuelLevel !== null && pos.fuelLevel !== undefined);
    
    if (positionsWithFuel.length < 2) {
      return {
        totalFuelUsed: 0,
        averageFuelLevel: 0,
        refuelEvents: 0,
        fuelEfficiency: 0
      };
    }

    // Calculate fuel consumption
    let totalFuelUsed = 0;
    let refuelEvents = 0;
    let previousFuel = positionsWithFuel[0].fuelLevel!;

    for (let i = 1; i < positionsWithFuel.length; i++) {
      const currentFuel = positionsWithFuel[i].fuelLevel!;
      const fuelDiff = currentFuel - previousFuel;
      
      if (fuelDiff > 5) { // Significant increase = refuel
        refuelEvents++;
      } else if (fuelDiff < 0) { // Decrease = consumption
        totalFuelUsed += Math.abs(fuelDiff);
      }
      
      previousFuel = currentFuel;
    }

    const averageFuelLevel = positionsWithFuel.reduce((sum, pos) => sum + pos.fuelLevel!, 0) / positionsWithFuel.length;
    
    // Calculate distance for efficiency (simplified)
    let totalDistance = 0;
    for (let i = 1; i < positions.length; i++) {
      const distance = this.calculateDistance(
        positions[i-1].latitude, positions[i-1].longitude,
        positions[i].latitude, positions[i].longitude
      );
      totalDistance += distance;
    }

    const fuelEfficiency = totalFuelUsed > 0 ? totalDistance / totalFuelUsed : 0;

    return {
      totalFuelUsed,
      averageFuelLevel,
      refuelEvents,
      fuelEfficiency
    };
  }

  // Helper function to calculate distance between two points (Haversine formula)
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

// Production API functions
export const historyApi = {
  // Get historical positions with date range
  async getHistoricalPositions(deviceId: number, from: Date, to: Date, limit?: number): Promise<HistoricalPosition[]> {
    return HistoryApiClient.getHistoricalPositions(deviceId, from, to, limit);
  },

  // Get daily positions
  async getDailyPositions(deviceId: number, date: Date): Promise<HistoricalPosition[]> {
    return HistoryApiClient.getDailyPositions(deviceId, date);
  },

  // Get recent positions
  async getRecentPositions(deviceId: number, days?: number): Promise<HistoricalPosition[]> {
    return HistoryApiClient.getRecentPositions(deviceId, days);
  },

  // Get fuel consumption summary
  async getFuelConsumptionSummary(deviceId: number, from: Date, to: Date) {
    return HistoryApiClient.getFuelConsumptionSummary(deviceId, from, to);
  }
};

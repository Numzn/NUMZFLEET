import { db } from './firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

// Use the same credential source as traccar.ts
const getTraccarCredentials = (): { username: string; password: string } | null => {
  const authString = import.meta.env.VITE_TRACCAR_AUTH || btoa('numerinyirenda14@gmail.com:numz0099');
  
  try {
    const decoded = atob(authString);
    const [username, password] = decoded.split(':');
    
    if (username && password) {
      return { username, password };
    }
  } catch (error) {
    console.warn('Failed to decode Traccar credentials');
  }

  return null;
};

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string;
  positionId: number;
  groupId: number;
  phone: string;
  model: string;
  contact: string;
  category: string;
  disabled: boolean;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol: string;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address: string;
  accuracy: number;
  network: any;
  attributes: any;
}

export interface TraccarSyncData {
  devices: TraccarDevice[];
  positions: TraccarPosition[];
  lastSync: string;
}

class TraccarSyncService {
  private baseUrl: string;
  private credentials: { username: string; password: string } | null;
  private hasCredentialError: boolean = false;

  constructor() {
    this.baseUrl = import.meta.env.VITE_TRACCAR_URL || 'http://localhost:8082';
    this.credentials = getTraccarCredentials();
    
    if (!this.credentials) {
      console.warn('⚠️ Traccar credentials not configured - sync service will be disabled');
      this.hasCredentialError = true;
    }
  }

  private async makeRequest(endpoint: string): Promise<any> {
    if (!this.credentials) {
      throw new Error('Traccar credentials not configured');
    }

    const authHeader = `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`;
    
    const response = await fetch(`${this.baseUrl}/api/${endpoint}`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Traccar API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getDevices(): Promise<TraccarDevice[]> {
    try {
      // Skip if we have credential errors to prevent infinite retries
      if (this.hasCredentialError) {
        console.warn('⚠️ Skipping device fetch due to credential errors');
        return [];
      }

      const devices = await this.makeRequest('devices');
      console.log('📱 Fetched Traccar devices:', devices.length);
      return devices;
    } catch (error) {
      if (error instanceof Error && error.message.includes('credentials not configured')) {
        console.warn('⚠️ Traccar credentials not configured, marking service as disabled');
        this.hasCredentialError = true;
        return [];
      }
      console.error('Failed to fetch Traccar devices:', error);
      return [];
    }
  }

  async getPositions(): Promise<TraccarPosition[]> {
    try {
      // Skip if we have credential errors to prevent infinite retries
      if (this.hasCredentialError) {
        console.warn('⚠️ Skipping position fetch due to credential errors');
        return [];
      }

      const positions = await this.makeRequest('positions');
      console.log('📍 Fetched Traccar positions:', positions.length);
      return positions;
    } catch (error) {
      if (error instanceof Error && error.message.includes('credentials not configured')) {
        console.warn('⚠️ Traccar credentials not configured, marking service as disabled');
        this.hasCredentialError = true;
        return [];
      }
      console.error('Failed to fetch Traccar positions:', error);
      return [];
    }
  }

  async getDevicePositions(deviceId: number): Promise<TraccarPosition[]> {
    try {
      // Skip if we have credential errors
      if (this.hasCredentialError) {
        console.warn('⚠️ Skipping device position fetch due to credential errors');
        return [];
      }

      const positions = await this.makeRequest(`positions?deviceId=${deviceId}`);
      console.log(`📍 Fetched positions for device ${deviceId}:`, positions.length);
      return positions;
    } catch (error) {
      console.error(`Failed to fetch positions for device ${deviceId}:`, error);
      return [];
    }
  }

  async syncToFirebase(): Promise<TraccarSyncData> {
    try {
      // Check if credentials are available before starting sync
      if (!this.credentials || this.hasCredentialError) {
        console.warn('⚠️ Traccar credentials not configured or service disabled, skipping sync');
        return {
          devices: [],
          positions: [],
          lastSync: new Date().toISOString()
        };
      }

      console.log('🔄 Starting Traccar to Firebase sync...');
      
      const [devices, positions] = await Promise.all([
        this.getDevices(),
        this.getPositions()
      ]);

      // Update Firebase with latest data
      await this.updateFirebaseData(devices, positions);

      const syncData: TraccarSyncData = {
        devices,
        positions,
        lastSync: new Date().toISOString()
      };

      console.log('✅ Traccar sync completed:', {
        devices: devices.length,
        positions: positions.length,
        lastSync: syncData.lastSync
      });

      return syncData;
    } catch (error) {
      console.error('❌ Traccar sync failed:', error);
      throw error;
    }
  }

  private async updateFirebaseData(devices: TraccarDevice[], positions: TraccarPosition[]) {
    try {
      // Update devices in Firebase
      for (const device of devices) {
        const deviceRef = doc(db, 'traccar_devices', device.id.toString());
        await setDoc(deviceRef, {
          ...device,
          lastSync: new Date().toISOString()
        }, { merge: true });
      }

      // Update positions in Firebase
      for (const position of positions) {
        const positionRef = doc(db, 'traccar_positions', position.id.toString());
        await setDoc(positionRef, {
          ...position,
          lastSync: new Date().toISOString()
        }, { merge: true });
      }

      // Update sync status
      const syncRef = doc(db, 'system', 'traccar_sync');
      await setDoc(syncRef, {
        lastSync: new Date().toISOString(),
        deviceCount: devices.length,
        positionCount: positions.length,
        status: 'success'
      }, { merge: true });

      console.log('🔥 Firebase updated with Traccar data');
    } catch (error) {
      console.error('Failed to update Firebase with Traccar data:', error);
      throw error;
    }
  }

  async updateVehicleLocation(vehicleId: string, deviceId: number): Promise<boolean> {
    try {
      const positions = await this.getDevicePositions(deviceId);
      if (positions.length === 0) {
        console.warn(`No positions found for device ${deviceId}`);
        return false;
      }

      const latestPosition = positions[0]; // Most recent position
      
      // Update vehicle document with latest location
      const vehicleRef = doc(db, 'vehicles', vehicleId);
      await updateDoc(vehicleRef, {
        lastLocation: {
          latitude: latestPosition.latitude,
          longitude: latestPosition.longitude,
          speed: latestPosition.speed,
          course: latestPosition.course,
          address: latestPosition.address,
          timestamp: latestPosition.fixTime,
          accuracy: latestPosition.accuracy
        },
        isOnline: true,
        lastUpdate: new Date().toISOString()
      });

      console.log(`📍 Updated vehicle ${vehicleId} location from device ${deviceId}`);
      return true;
    } catch (error) {
      console.error(`Failed to update vehicle ${vehicleId} location:`, error);
      return false;
    }
  }

  // Method to reset credential errors (useful for testing)
  resetCredentialErrors(): void {
    this.hasCredentialError = false;
    this.credentials = getTraccarCredentials();
    if (this.credentials) {
      console.log('🔄 Traccar credentials restored, sync service re-enabled');
    }
  }

  // Method to check if service is available
  isServiceAvailable(): boolean {
    return !this.hasCredentialError && !!this.credentials;
  }

  // Method to get current status for debugging
  getStatus(): {
    hasCredentials: boolean;
    hasCredentialError: boolean;
    baseUrl: string;
    isAvailable: boolean;
  } {
    return {
      hasCredentials: !!this.credentials,
      hasCredentialError: this.hasCredentialError,
      baseUrl: this.baseUrl,
      isAvailable: this.isServiceAvailable()
    };
  }

  // Method to test connection (useful for debugging)
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      if (!this.credentials) {
        return {
          success: false,
          message: 'No credentials configured'
        };
      }

      if (this.hasCredentialError) {
        return {
          success: false,
          message: 'Service disabled due to credential errors'
        };
      }

      // Try to fetch devices as a connection test
      const devices = await this.makeRequest('devices');
      return {
        success: true,
        message: `Connection successful - Found ${devices.length} devices`,
        details: {
          deviceCount: devices.length,
          baseUrl: this.baseUrl,
          hasCredentials: true
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          baseUrl: this.baseUrl,
          hasCredentials: !!this.credentials,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

export const traccarSync = new TraccarSyncService();



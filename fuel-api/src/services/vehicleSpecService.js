import { VehicleSpec } from '../models/index.js';
import { getDeviceAttributes } from '../config/traccar.js';

// In-memory cache for vehicle specs
const specCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get vehicle specification by device ID
 * First checks cache, then database, then syncs from Traccar if needed
 */
export const getVehicleSpec = async (deviceId) => {
  const cacheKey = `device_${deviceId}`;
  const cached = specCache.get(cacheKey);
  
  // Check cache first
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Try to find in database
    let vehicleSpec = await VehicleSpec.findOne({
      where: { deviceId }
    });

    // Sync from Traccar only for specs that have never been manually
    // configured. A manager override (customOverride: true) must never be
    // silently re-synced back to defaults, regardless of syncedFromTraccar.
    if (!vehicleSpec || (!vehicleSpec.customOverride && !vehicleSpec.syncedFromTraccar)) {
      vehicleSpec = await syncFromTraccar(deviceId);
    }

    // Cache the result
    if (vehicleSpec) {
      specCache.set(cacheKey, {
        data: vehicleSpec,
        timestamp: Date.now()
      });
    }

    return vehicleSpec;
  } catch (error) {
    console.error('Error getting vehicle spec:', error);
    // Return default specs if error
    return getDefaultVehicleSpec(deviceId);
  }
};

/**
 * Provenance for a spec's tankCapacity: 'verified' when a manager has
 * explicitly overridden it, 'default' when it's still the Traccar-synced
 * or hardcoded fallback value.
 */
export const getTankCapacitySource = (spec) => (spec?.customOverride ? 'verified' : 'default');

/**
 * Sync vehicle specifications from Traccar device attributes
 */
export const syncFromTraccar = async (deviceId) => {
  try {
    const deviceAttributes = await getDeviceAttributes(deviceId);
    
    // Extract specs from attributes or use defaults
    const tankCapacity = deviceAttributes?.tankCapacity || 60; // Default 60L
    const fuelEfficiency = deviceAttributes?.fuelEfficiency || 10; // Default 10 km/L
    const fuelType = deviceAttributes?.fuelType || 'Petrol';

    // Create or update vehicle spec
    const [vehicleSpec, created] = await VehicleSpec.upsert({
      deviceId,
      tankCapacity,
      fuelEfficiency,
      fuelType,
      lastUpdated: new Date(),
      syncedFromTraccar: true,
      customOverride: false
    });

    // Clear cache
    specCache.delete(`device_${deviceId}`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${created ? 'Created' : 'Updated'} vehicle spec for device ${deviceId}`);
    }
    return vehicleSpec;
  } catch (error) {
    console.error('Error syncing from Traccar:', error);
    return getDefaultVehicleSpec(deviceId);
  }
};

/**
 * Update vehicle specifications manually (manager override)
 */
export const updateVehicleSpec = async (deviceId, specs) => {
  try {
    const [vehicleSpec] = await VehicleSpec.upsert({
      deviceId,
      tankCapacity: specs.tankCapacity,
      fuelEfficiency: specs.fuelEfficiency,
      fuelType: specs.fuelType || 'Petrol',
      lastUpdated: new Date(),
      syncedFromTraccar: false,
      customOverride: true
    });

    // Clear cache
    specCache.delete(`device_${deviceId}`);
    
    return vehicleSpec;
  } catch (error) {
    console.error('Error updating vehicle spec:', error);
    throw error;
  }
};

/**
 * Get default vehicle specifications
 */
export const getDefaultVehicleSpec = (deviceId) => {
  return {
    deviceId,
    tankCapacity: 60, // Default 60L tank
    fuelEfficiency: 10, // Default 10 km/L
    fuelType: 'Petrol',
    lastUpdated: new Date(),
    syncedFromTraccar: false,
    customOverride: false
  };
};

/**
 * Clear cache for specific device
 */
export const clearCache = (deviceId) => {
  specCache.delete(`device_${deviceId}`);
};

/**
 * Clear all cache
 */
export const clearAllCache = () => {
  specCache.clear();
};




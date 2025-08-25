import { analytics } from './firebase';
import { logEvent } from 'firebase/analytics';

// Analytics event tracking utility
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (!analytics) {
    console.warn('Analytics not available');
    return;
  }

  try {
    logEvent(analytics, eventName, parameters);
    console.log('Analytics event tracked:', eventName, parameters);
  } catch (error) {
    console.error('Error tracking analytics event:', error);
  }
};

// Predefined event types for consistency
export const AnalyticsEvents = {
  // Page views
  PAGE_VIEW: 'page_view',
  
  // Vehicle tracking
  VEHICLE_SELECTED: 'vehicle_selected',
  VEHICLE_TRACKED: 'vehicle_tracked',
  VEHICLE_ADDED: 'vehicle_added',
  VEHICLE_EDITED: 'vehicle_edited',
  VEHICLE_DELETED: 'vehicle_deleted',
  
  // Driver management
  DRIVER_ADDED: 'driver_added',
  DRIVER_EDITED: 'driver_edited',
  DRIVER_DELETED: 'driver_deleted',
  
  // Fuel records
  FUEL_RECORD_ADDED: 'fuel_record_added',
  FUEL_RECORD_EDITED: 'fuel_record_edited',
  FUEL_RECORD_DELETED: 'fuel_record_deleted',
  
  // Traccar integration
  TRACCAR_CONNECTED: 'traccar_connected',
  TRACCAR_DISCONNECTED: 'traccar_disconnected',
  TRACCAR_DEVICE_SELECTED: 'traccar_device_selected',
  
  // User actions
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  SETTINGS_CHANGED: 'settings_changed',
  
  // Reports and analytics
  REPORT_GENERATED: 'report_generated',
  ANALYTICS_VIEWED: 'analytics_viewed',
  
  // Errors
  ERROR_OCCURRED: 'error_occurred',
} as const;

// Helper functions for common tracking scenarios
export const AnalyticsHelpers = {
  // Track page views
  trackPageView: (pageName: string) => {
    trackEvent(AnalyticsEvents.PAGE_VIEW, { page_name: pageName });
  },
  
  // Track vehicle actions
  trackVehicleAction: (action: string, vehicleId: string, vehicleName?: string) => {
    trackEvent(action, { 
      vehicle_id: vehicleId, 
      vehicle_name: vehicleName 
    });
  },
  
  // Track driver actions
  trackDriverAction: (action: string, driverId: string, driverName?: string) => {
    trackEvent(action, { 
      driver_id: driverId, 
      driver_name: driverName 
    });
  },
  
  // Track fuel record actions
  trackFuelRecordAction: (action: string, recordId: string, vehicleId?: string) => {
    trackEvent(action, { 
      record_id: recordId, 
      vehicle_id: vehicleId 
    });
  },
  
  // Track Traccar events
  trackTraccarEvent: (event: string, deviceId?: number, deviceName?: string) => {
    trackEvent(event, { 
      device_id: deviceId, 
      device_name: deviceName 
    });
  },
  
  // Track errors
  trackError: (errorType: string, errorMessage: string, context?: Record<string, any>) => {
    trackEvent(AnalyticsEvents.ERROR_OCCURRED, {
      error_type: errorType,
      error_message: errorMessage,
      ...context
    });
  },
};

// Real analytics calculations based on actual data
export const calculateEfficiencyScore = (fuelRecords: any[], vehicles: any[]): number => {
  if (!fuelRecords || !vehicles || fuelRecords.length === 0) return 0;
  
  // Calculate actual fuel efficiency metrics
  const totalFuelUsed = fuelRecords.reduce((sum, record) => sum + (record.fuelAmount || 0), 0);
  const totalDistance = fuelRecords.reduce((sum, record) => sum + (record.distance || 0), 0);
  
  // Calculate average fuel efficiency (L/100km or MPG)
  const avgEfficiency = totalDistance > 0 ? (totalFuelUsed / totalDistance) * 100 : 0;
  
  // Calculate cost efficiency
  const totalCost = fuelRecords.reduce((sum, record) => sum + (record.fuelCost || 0), 0);
  const costPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;
  
  // Calculate score based on multiple factors
  let score = 0;
  
  // Fuel efficiency factor (40% weight)
  if (avgEfficiency > 0) {
    const efficiencyScore = Math.max(0, Math.min(100, (15 - avgEfficiency) * 10)); // Lower consumption = higher score
    score += efficiencyScore * 0.4;
  }
  
  // Cost efficiency factor (30% weight)
  if (costPerKm > 0) {
    const costScore = Math.max(0, Math.min(100, (2 - costPerKm) * 50)); // Lower cost = higher score
    score += costScore * 0.3;
  }
  
  // Consistency factor (20% weight) - based on variance in fuel consumption
  const fuelAmounts = fuelRecords.map(r => r.fuelAmount || 0).filter(amount => amount > 0);
  if (fuelAmounts.length > 1) {
    const mean = fuelAmounts.reduce((sum, val) => sum + val, 0) / fuelAmounts.length;
    const variance = fuelAmounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / fuelAmounts.length;
    const consistencyScore = Math.max(0, Math.min(100, 100 - (variance / mean) * 10));
    score += consistencyScore * 0.2;
  }
  
  // Fleet utilization factor (10% weight)
  const activeVehicles = vehicles.filter(v => v.status === 'active').length;
  const utilizationScore = vehicles.length > 0 ? (activeVehicles / vehicles.length) * 100 : 0;
  score += utilizationScore * 0.1;
  
  return Math.round(score);
};

// Additional real analytics functions
export const calculateFuelMetrics = (fuelRecords: any[]) => {
  if (!fuelRecords || fuelRecords.length === 0) {
    return {
      totalFuelUsed: 0,
      totalCost: 0,
      averageEfficiency: 0,
      monthlyTrend: [],
      costPerKm: 0
    };
  }

  const totalFuelUsed = fuelRecords.reduce((sum, record) => sum + (record.fuelAmount || 0), 0);
  const totalCost = fuelRecords.reduce((sum, record) => sum + (record.fuelCost || 0), 0);
  const totalDistance = fuelRecords.reduce((sum, record) => sum + (record.distance || 0), 0);
  
  // Calculate monthly trends
  const monthlyData = fuelRecords.reduce((acc, record) => {
    const date = new Date(record.date || record.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = { fuel: 0, cost: 0, distance: 0, count: 0 };
    }
    
    acc[monthKey].fuel += record.fuelAmount || 0;
    acc[monthKey].cost += record.fuelCost || 0;
    acc[monthKey].distance += record.distance || 0;
    acc[monthKey].count += 1;
    
    return acc;
  }, {} as Record<string, any>);

  const monthlyTrend = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    averageEfficiency: (data as any).distance > 0 ? ((data as any).fuel / (data as any).distance) * 100 : 0,
    totalCost: (data as any).cost,
    totalFuel: (data as any).fuel
  }));

  return {
    totalFuelUsed,
    totalCost,
    averageEfficiency: totalDistance > 0 ? (totalFuelUsed / totalDistance) * 100 : 0,
    monthlyTrend,
    costPerKm: totalDistance > 0 ? totalCost / totalDistance : 0
  };
};

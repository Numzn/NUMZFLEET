import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { optimizedTraccarApi, OptimizationOptions, OptimizationResult } from '@/lib/optimized-traccar';
import { TraccarDevice, TraccarPosition } from '@shared/schema';

// Hook for optimized device data
export const useOptimizedDevices = () => {
  return useQuery({
    queryKey: ['optimized-devices'],
    queryFn: () => optimizedTraccarApi.getDevices(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });
};

// Hook for optimized positions
export const useOptimizedPositions = (
  deviceId: number | undefined,
  options: OptimizationOptions = {}
) => {
  return useQuery({
    queryKey: ['optimized-positions', deviceId, options],
    queryFn: () => {
      if (!deviceId) throw new Error('Device ID is required');
      return optimizedTraccarApi.getOptimizedPositions(deviceId, options);
    },
    enabled: !!deviceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2
  });
};

// Hook for optimized historical positions
export const useOptimizedHistoricalPositions = (
  deviceId: number | undefined,
  from: Date | undefined,
  to: Date | undefined,
  options: OptimizationOptions = {}
) => {
  return useQuery({
    queryKey: ['optimized-historical-positions', deviceId, from, to, options],
    queryFn: () => {
      if (!deviceId || !from || !to) throw new Error('Device ID, from, and to dates are required');
      return optimizedTraccarApi.getOptimizedHistoricalPositions(deviceId, from, to, options);
    },
    enabled: !!deviceId && !!from && !!to,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2
  });
};

// Hook for optimization statistics
export const useOptimizationStats = (
  deviceId: number | undefined,
  days: number = 7
) => {
  return useQuery({
    queryKey: ['optimization-stats', deviceId, days],
    queryFn: () => {
      if (!deviceId) throw new Error('Device ID is required');
      return optimizedTraccarApi.getOptimizationStats(deviceId, days);
    },
    enabled: !!deviceId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 2
  });
};

// Hook for optimization service status
export const useOptimizationServiceStatus = () => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const available = await optimizedTraccarApi.testOptimizationService();
      setIsAvailable(available);
    } catch (error) {
      console.error('Error checking optimization service status:', error);
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isAvailable,
    isLoading,
    refetch: checkStatus
  };
};

// Hook for optimization settings management
export const useOptimizationSettings = () => {
  const [settings, setSettings] = useState<OptimizationOptions>({
    tolerance: 10,
    minSpeed: 5,
    minTimeInterval: 30000,
    maxSpeed: 200,
    minAccuracy: 100,
    preserveStops: true,
    preserveSpeedChanges: true,
    enableTimeFilter: true,
    enableSpeedFilter: true,
    enableAccuracyFilter: true
  });

  const updateSettings = useCallback((newSettings: Partial<OptimizationOptions>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({
      tolerance: 10,
      minSpeed: 5,
      minTimeInterval: 30000,
      maxSpeed: 200,
      minAccuracy: 100,
      preserveStops: true,
      preserveSpeedChanges: true,
      enableTimeFilter: true,
      enableSpeedFilter: true,
      enableAccuracyFilter: true
    });
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings
  };
};

// Hook for optimization performance monitoring
export const useOptimizationPerformance = () => {
  const [performanceData, setPerformanceData] = useState<{
    totalRequests: number;
    totalOptimizations: number;
    averageReduction: number;
    bandwidthSaved: number;
    lastOptimization?: OptimizationResult;
  }>({
    totalRequests: 0,
    totalOptimizations: 0,
    averageReduction: 0,
    bandwidthSaved: 0
  });

  const recordOptimization = useCallback((result: OptimizationResult) => {
    setPerformanceData(prev => {
      const newTotalRequests = prev.totalRequests + 1;
      const newTotalOptimizations = prev.totalOptimizations + 1;
      const newAverageReduction = 
        (prev.averageReduction * prev.totalOptimizations + result.reductionPercentage) / 
        newTotalOptimizations;
      const newBandwidthSaved = prev.bandwidthSaved + result.reductionPercentage;

      return {
        totalRequests: newTotalRequests,
        totalOptimizations: newTotalOptimizations,
        averageReduction: newAverageReduction,
        bandwidthSaved: newBandwidthSaved,
        lastOptimization: result
      };
    });
  }, []);

  const resetPerformance = useCallback(() => {
    setPerformanceData({
      totalRequests: 0,
      totalOptimizations: 0,
      averageReduction: 0,
      bandwidthSaved: 0
    });
  }, []);

  return {
    performanceData,
    recordOptimization,
    resetPerformance
  };
};

// Hook for adaptive optimization based on device performance
export const useAdaptiveOptimization = (deviceId: number | undefined) => {
  const { data: stats } = useOptimizationStats(deviceId, 7);
  const { settings, updateSettings } = useOptimizationSettings();

  useEffect(() => {
    if (!stats) return;

    // Adaptive tolerance based on optimization potential
    if (stats.optimizationPotential.withTolerance25 > 50) {
      updateSettings({ tolerance: 25 });
    } else if (stats.optimizationPotential.withTolerance10 > 30) {
      updateSettings({ tolerance: 10 });
    } else {
      updateSettings({ tolerance: 5 });
    }

    // Adaptive time interval based on data density
    if (stats.totalPositions > 5000) {
      updateSettings({ minTimeInterval: 60000 }); // 1 minute
    } else if (stats.totalPositions > 1000) {
      updateSettings({ minTimeInterval: 30000 }); // 30 seconds
    } else {
      updateSettings({ minTimeInterval: 15000 }); // 15 seconds
    }
  }, [stats, updateSettings]);

  return {
    settings,
    stats,
    isAdaptive: true
  };
};



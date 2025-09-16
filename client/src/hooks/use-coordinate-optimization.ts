import { useState, useCallback, useMemo } from 'react';
import { optimizeCoordinates } from '@/utils/optimization';
import { OptimizationOptions, OptimizationResult, OptimizationSettings, PerformanceData } from '@/types/optimization';

const defaultSettings: OptimizationSettings = {
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
};

export function useCoordinateOptimization() {
  const [settings, setSettings] = useState<OptimizationSettings>(defaultSettings);
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    totalOptimizations: 0,
    averageReduction: 0,
    totalBandwidthSaved: 0
  });

  // Optimize positions with current settings
  const optimizePositions = useCallback((positions: any[]): OptimizationResult => {
    if (!positions || positions.length === 0) {
      return {
        originalCount: 0,
        optimizedCount: 0,
        reductionPercentage: 0,
        statistics: {
          accuracyFiltered: 0,
          speedFiltered: 0,
          timeFiltered: 0,
          douglasPeuckerReduced: 0
        },
        optimizedPositions: []
      };
    }

    const result = optimizeCoordinates(positions, settings);
    
    // Update performance data
    setPerformanceData(prev => {
      const newTotalOptimizations = prev.totalOptimizations + 1;
      const newAverageReduction = 
        (prev.averageReduction * prev.totalOptimizations + result.reductionPercentage) / 
        newTotalOptimizations;
      const newBandwidthSaved = prev.totalBandwidthSaved + result.reductionPercentage;

      return {
        totalOptimizations: newTotalOptimizations,
        averageReduction: newAverageReduction,
        totalBandwidthSaved: newBandwidthSaved,
        lastOptimization: result
      };
    });

    return result;
  }, [settings]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<OptimizationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Reset settings to defaults
  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  // Reset performance data
  const resetPerformance = useCallback(() => {
    setPerformanceData({
      totalOptimizations: 0,
      averageReduction: 0,
      totalBandwidthSaved: 0
    });
  }, []);

  // Preset configurations
  const presets = useMemo(() => ({
    conservative: {
      tolerance: 5,
      minSpeed: 2,
      minTimeInterval: 15000,
      maxSpeed: 200,
      minAccuracy: 50,
      preserveStops: true,
      preserveSpeedChanges: true,
      enableTimeFilter: true,
      enableSpeedFilter: true,
      enableAccuracyFilter: true
    },
    balanced: {
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
    },
    aggressive: {
      tolerance: 25,
      minSpeed: 10,
      minTimeInterval: 60000,
      maxSpeed: 200,
      minAccuracy: 100,
      preserveStops: true,
      preserveSpeedChanges: false,
      enableTimeFilter: true,
      enableSpeedFilter: true,
      enableAccuracyFilter: true
    }
  }), []);

  // Apply preset
  const applyPreset = useCallback((presetName: keyof typeof presets) => {
    setSettings(presets[presetName]);
  }, [presets]);

  return {
    settings,
    updateSettings,
    resetSettings,
    optimizePositions,
    performanceData,
    resetPerformance,
    presets,
    applyPreset
  };
}

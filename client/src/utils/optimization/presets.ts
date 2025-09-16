/**
 * Optimization Presets
 * Predefined configurations for different use cases
 */

import { OptimizationSettings, OptimizationPresets } from '@/types/optimization';

export const DEFAULT_SETTINGS: OptimizationSettings = {
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

export const OPTIMIZATION_PRESETS: OptimizationPresets = {
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
};

export function getPreset(presetName: keyof OptimizationPresets): OptimizationSettings {
  return OPTIMIZATION_PRESETS[presetName];
}

export function getPresetNames(): (keyof OptimizationPresets)[] {
  return Object.keys(OPTIMIZATION_PRESETS) as (keyof OptimizationPresets)[];
}



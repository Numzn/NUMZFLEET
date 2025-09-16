/**
 * Main Coordinate Optimization Service
 * Orchestrates the optimization process using algorithms and filters
 */

import { OptimizationOptions, OptimizationResult } from '@/types/optimization';
import { advancedDouglasPeucker } from './algorithms';
import { applyFilters } from './filters';

/**
 * Main coordinate optimization function
 */
export function optimizeCoordinates(positions: any[], options: OptimizationOptions = {}): OptimizationResult {
  const {
    tolerance = 10,
    minSpeed = 5,
    minTimeInterval = 30000,
    maxSpeed = 200,
    minAccuracy = 100,
    preserveStops = true,
    preserveSpeedChanges = true,
    enableTimeFilter = true,
    enableSpeedFilter = true,
    enableAccuracyFilter = true
  } = options;


  let optimized = [...positions];
  const originalCount = positions.length;

  // Step 1: Apply filters
  const beforeFilters = optimized.length;
  optimized = applyFilters(optimized, {
    enableSpeedFilter,
    enableTimeFilter,
    enableAccuracyFilter,
    maxSpeed,
    minTimeInterval,
    minAccuracy
  });

  // Step 2: Apply Douglas-Peucker algorithm
  const beforeDouglas = optimized.length;
  optimized = advancedDouglasPeucker(optimized, {
    tolerance,
    minSpeed,
    preserveStops,
    preserveSpeedChanges
  });

  const reductionPercentage = ((originalCount - optimized.length) / originalCount * 100);
  

  return {
    originalCount,
    optimizedCount: optimized.length,
    reductionPercentage: parseFloat(reductionPercentage.toFixed(1)),
    optimizedPositions: optimized,
    statistics: {
      accuracyFiltered: enableAccuracyFilter ? originalCount - applyFilters(positions, { enableAccuracyFilter: true, minAccuracy }).length : 0,
      speedFiltered: enableSpeedFilter ? originalCount - applyFilters(positions, { enableSpeedFilter: true, maxSpeed }).length : 0,
      timeFiltered: enableTimeFilter ? originalCount - applyFilters(positions, { enableTimeFilter: true, minTimeInterval }).length : 0,
      douglasPeuckerReduced: beforeDouglas - optimized.length
    }
  };
}

/**
 * Quick optimization with sensible defaults
 */
export function quickOptimize(positions: any[]): OptimizationResult {
  return optimizeCoordinates(positions, {
    tolerance: 10,
    minSpeed: 5,
    minTimeInterval: 30000,
    maxSpeed: 200,
    minAccuracy: 100,
    preserveStops: true,
    preserveSpeedChanges: true
  });
}

/**
 * Aggressive optimization for large datasets
 */
export function aggressiveOptimize(positions: any[]): OptimizationResult {
  return optimizeCoordinates(positions, {
    tolerance: 25,
    minSpeed: 10,
    minTimeInterval: 60000,
    maxSpeed: 200,
    minAccuracy: 50,
    preserveStops: true,
    preserveSpeedChanges: false
  });
}

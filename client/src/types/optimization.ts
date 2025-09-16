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
  optimizedPositions: any[];
}

export interface OptimizationSettings {
  tolerance: number;
  minSpeed: number;
  minTimeInterval: number;
  maxSpeed: number;
  minAccuracy: number;
  preserveStops: boolean;
  preserveSpeedChanges: boolean;
  enableTimeFilter: boolean;
  enableSpeedFilter: boolean;
  enableAccuracyFilter: boolean;
}

export interface OptimizationPresets {
  conservative: OptimizationSettings;
  balanced: OptimizationSettings;
  aggressive: OptimizationSettings;
}

export interface PerformanceData {
  totalOptimizations: number;
  averageReduction: number;
  totalBandwidthSaved: number;
  lastOptimization?: OptimizationResult;
}



// Efficiency Scoring System for Replay Analysis
import { HistoricalPosition } from '@/lib/history-api';

export interface EfficiencySegment {
  start: HistoricalPosition;
  end: HistoricalPosition;
  score: number;
  color: string;
  distance: number;
  duration: number; // in minutes
  averageSpeed: number; // km/h
  efficiencyFactors: {
    harshAcceleration: boolean;
    harshBraking: boolean;
    excessiveSpeed: boolean;
    idling: boolean;
    fuelConsumption: number;
  };
}

export interface IdlePeriod {
  start: HistoricalPosition;
  end: HistoricalPosition;
  duration: number; // in minutes
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  isSignificant: boolean;
}

// Configuration for efficiency scoring
const EFFICIENCY_CONFIG = {
  // Speed thresholds (km/h)
  EXCESSIVE_SPEED: 100,
  IDLE_SPEED: 3,
  
  // Time thresholds (minutes)
  IDLE_THRESHOLD: 5,
  SIGNIFICANT_IDLE: 15,
  
  // Scoring weights
  WEIGHTS: {
    HARSH_ACCELERATION: -30,
    HARSH_BRAKING: -30,
    EXCESSIVE_SPEED: -2, // per km/h over limit
    IDLING: -1, // per minute
    FUEL_EFFICIENCY: 10, // bonus for good fuel usage
  },
  
  // Color thresholds
  COLOR_THRESHOLDS: {
    EXCELLENT: 80,
    GOOD: 60,
    FAIR: 40,
    POOR: 20,
  }
} as const;

/**
 * Calculate efficiency score for a segment between two positions
 */
export const calculateEfficiencyScore = (
  start: HistoricalPosition, 
  end: HistoricalPosition
): number => {
  let score = 100; // Start with perfect score
  
  // Calculate basic metrics
  const distance = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);
  const duration = (new Date(end.deviceTime).getTime() - new Date(start.deviceTime).getTime()) / (1000 * 60); // minutes
  const averageSpeed = duration > 0 ? (distance / duration) * 60 : 0; // km/h
  
  // Check for harsh events
  if (end.harshAcceleration) {
    score += EFFICIENCY_CONFIG.WEIGHTS.HARSH_ACCELERATION;
  }
  
  if (end.harshBraking) {
    score += EFFICIENCY_CONFIG.WEIGHTS.HARSH_BRAKING;
  }
  
  // Check for excessive speed
  if (averageSpeed > EFFICIENCY_CONFIG.EXCESSIVE_SPEED) {
    const speedPenalty = (averageSpeed - EFFICIENCY_CONFIG.EXCESSIVE_SPEED) * EFFICIENCY_CONFIG.WEIGHTS.EXCESSIVE_SPEED;
    score += speedPenalty;
  }
  
  // Check for idling
  if (averageSpeed < EFFICIENCY_CONFIG.IDLE_SPEED && duration > 1) {
    const idlePenalty = duration * EFFICIENCY_CONFIG.WEIGHTS.IDLING;
    score += idlePenalty;
  }
  
  // Fuel efficiency bonus/penalty
  if (start.fuelLevel !== null && end.fuelLevel !== null) {
    const fuelUsed = start.fuelLevel - end.fuelLevel;
    if (fuelUsed > 0 && distance > 0) {
      const fuelEfficiency = distance / fuelUsed; // km per % fuel
      if (fuelEfficiency > 2) { // Good efficiency
        score += EFFICIENCY_CONFIG.WEIGHTS.FUEL_EFFICIENCY;
      } else if (fuelEfficiency < 0.5) { // Poor efficiency
        score -= EFFICIENCY_CONFIG.WEIGHTS.FUEL_EFFICIENCY;
      }
    }
  }
  
  return Math.max(0, Math.min(100, score)); // Clamp between 0 and 100
};

/**
 * Get color for efficiency score
 */
export const getEfficiencyColor = (score: number): string => {
  if (score >= EFFICIENCY_CONFIG.COLOR_THRESHOLDS.EXCELLENT) {
    return '#10B981'; // Green - Excellent
  } else if (score >= EFFICIENCY_CONFIG.COLOR_THRESHOLDS.GOOD) {
    return '#F59E0B'; // Yellow - Good
  } else if (score >= EFFICIENCY_CONFIG.COLOR_THRESHOLDS.FAIR) {
    return '#F97316'; // Orange - Fair
  } else {
    return '#EF4444'; // Red - Poor
  }
};

/**
 * Alias for getEfficiencyColor for backward compatibility
 */
export const getColorFromScore = getEfficiencyColor;

/**
 * Alias for calculateEfficiencyScore for backward compatibility
 */
export const getEfficiencyScore = calculateEfficiencyScore;

/**
 * Get efficiency label
 */
export const getEfficiencyLabel = (score: number): string => {
  if (score >= EFFICIENCY_CONFIG.COLOR_THRESHOLDS.EXCELLENT) {
    return 'Excellent';
  } else if (score >= EFFICIENCY_CONFIG.COLOR_THRESHOLDS.GOOD) {
    return 'Good';
  } else if (score >= EFFICIENCY_CONFIG.COLOR_THRESHOLDS.FAIR) {
    return 'Fair';
  } else {
    return 'Poor';
  }
};

/**
 * Process positions into efficiency segments
 */
export const processEfficiencySegments = (positions: HistoricalPosition[]): EfficiencySegment[] => {
  if (positions.length < 2) return [];
  
  const segments: EfficiencySegment[] = [];
  
  for (let i = 0; i < positions.length - 1; i++) {
    const start = positions[i];
    const end = positions[i + 1];
    
    const distance = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);
    const duration = (new Date(end.deviceTime).getTime() - new Date(start.deviceTime).getTime()) / (1000 * 60);
    const averageSpeed = duration > 0 ? (distance / duration) * 60 : 0;
    
    const score = calculateEfficiencyScore(start, end);
    const color = getEfficiencyColor(score);
    
    // Determine efficiency factors
    const efficiencyFactors = {
      harshAcceleration: end.harshAcceleration || false,
      harshBraking: end.harshBraking || false,
      excessiveSpeed: averageSpeed > EFFICIENCY_CONFIG.EXCESSIVE_SPEED,
      idling: averageSpeed < EFFICIENCY_CONFIG.IDLE_SPEED && duration > 1,
      fuelConsumption: start.fuelLevel !== null && end.fuelLevel !== null ? 
        start.fuelLevel - end.fuelLevel : 0
    };
    
    segments.push({
      start,
      end,
      score,
      color,
      distance,
      duration,
      averageSpeed,
      efficiencyFactors
    });
  }
  
  return segments;
};

/**
 * Detect idle periods in position data
 */
export const detectIdlePeriods = (
  positions: HistoricalPosition[], 
  idleThreshold: number = EFFICIENCY_CONFIG.IDLE_THRESHOLD
): IdlePeriod[] => {
  const idlePeriods: IdlePeriod[] = [];
  let idleStart: HistoricalPosition | null = null;
  
  for (let i = 0; i < positions.length - 1; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    
    const isStationary = (current.speed || 0) < EFFICIENCY_CONFIG.IDLE_SPEED && 
                        (next.speed || 0) < EFFICIENCY_CONFIG.IDLE_SPEED;
    
    if (isStationary && idleStart === null) {
      idleStart = current; // Start of potential idle period
    }
    
    if ((!isStationary || i === positions.length - 2) && idleStart !== null) {
      const idleEnd = isStationary ? next : current;
      const duration = (new Date(idleEnd.deviceTime).getTime() - new Date(idleStart.deviceTime).getTime()) / (1000 * 60);
      
      if (duration >= idleThreshold) {
        idlePeriods.push({
          start: idleStart,
          end: idleEnd,
          duration,
          location: {
            latitude: idleStart.latitude,
            longitude: idleStart.longitude,
            address: idleStart.address
          },
          isSignificant: duration >= EFFICIENCY_CONFIG.SIGNIFICANT_IDLE
        });
      }
      idleStart = null;
    }
  }
  
  return idlePeriods;
};

/**
 * Calculate overall efficiency statistics
 */
export const calculateEfficiencyStats = (segments: EfficiencySegment[]): {
  averageScore: number;
  totalDistance: number;
  totalDuration: number;
  averageSpeed: number;
  harshEvents: number;
  idleTime: number;
  fuelEfficiency: number;
  scoreDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
} => {
  if (segments.length === 0) {
    return {
      averageScore: 0,
      totalDistance: 0,
      totalDuration: 0,
      averageSpeed: 0,
      harshEvents: 0,
      idleTime: 0,
      fuelEfficiency: 0,
      scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 }
    };
  }
  
  const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);
  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
  const averageSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 60 : 0;
  const averageScore = segments.reduce((sum, seg) => sum + seg.score, 0) / segments.length;
  
  const harshEvents = segments.reduce((count, seg) => 
    count + (seg.efficiencyFactors.harshAcceleration ? 1 : 0) + (seg.efficiencyFactors.harshBraking ? 1 : 0), 0
  );
  
  const idleTime = segments.reduce((time, seg) => 
    time + (seg.efficiencyFactors.idling ? seg.duration : 0), 0
  );
  
  const totalFuelUsed = segments.reduce((fuel, seg) => fuel + seg.efficiencyFactors.fuelConsumption, 0);
  const fuelEfficiency = totalFuelUsed > 0 ? totalDistance / totalFuelUsed : 0;
  
  const scoreDistribution = segments.reduce((dist, seg) => {
    if (seg.score >= EFFICIENCY_CONFIG.COLOR_THRESHOLDS.EXCELLENT) dist.excellent++;
    else if (seg.score >= EFFICIENCY_CONFIG.COLOR_THRESHOLDS.GOOD) dist.good++;
    else if (seg.score >= EFFICIENCY_CONFIG.COLOR_THRESHOLDS.FAIR) dist.fair++;
    else dist.poor++;
    return dist;
  }, { excellent: 0, good: 0, fair: 0, poor: 0 });
  
  return {
    averageScore,
    totalDistance,
    totalDuration,
    averageSpeed,
    harshEvents,
    idleTime,
    fuelEfficiency,
    scoreDistribution
  };
};

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

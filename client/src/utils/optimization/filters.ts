/**
 * GPS Data Filtering Utilities
 * Various filters for cleaning and optimizing GPS position data
 */

/**
 * Filter positions by speed
 */
export function filterBySpeed(positions: any[], maxSpeed: number = 200): any[] {
  return positions.filter(pos => (pos.speed || 0) <= maxSpeed);
}

/**
 * Filter positions by time interval
 */
export function filterByTimeInterval(positions: any[], minTimeInterval: number = 30000): any[] {
  if (positions.length <= 1) {
    return positions;
  }

  const result = [positions[0]];
  let lastTime = new Date(positions[0].deviceTime || positions[0].serverTime).getTime();

  for (let i = 1; i < positions.length; i++) {
    const currentTime = new Date(positions[i].deviceTime || positions[i].serverTime).getTime();
    const timeDiff = currentTime - lastTime;

    if (timeDiff >= minTimeInterval) {
      result.push(positions[i]);
      lastTime = currentTime;
    }
  }

  return result;
}

/**
 * Filter positions by accuracy
 */
export function filterByAccuracy(positions: any[], minAccuracy: number = 100): any[] {
  return positions.filter(pos => !pos.accuracy || pos.accuracy <= minAccuracy);
}

/**
 * Filter positions by multiple criteria
 */
export function applyFilters(positions: any[], options: any = {}): any[] {
  const {
    enableSpeedFilter = true,
    enableTimeFilter = true,
    enableAccuracyFilter = true,
    maxSpeed = 200,
    minTimeInterval = 30000,
    minAccuracy = 100
  } = options;

  let filtered = [...positions];

  if (enableAccuracyFilter) {
    filtered = filterByAccuracy(filtered, minAccuracy);
  }

  if (enableSpeedFilter) {
    filtered = filterBySpeed(filtered, maxSpeed);
  }

  if (enableTimeFilter) {
    filtered = filterByTimeInterval(filtered, minTimeInterval);
  }

  return filtered;
}



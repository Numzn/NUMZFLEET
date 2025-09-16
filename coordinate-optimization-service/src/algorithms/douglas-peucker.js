/**
 * Douglas-Peucker Algorithm for Line Simplification
 * Reduces the number of points in a curve while maintaining its shape
 */

/**
 * Calculate the perpendicular distance from a point to a line segment
 * @param {Object} point - {latitude, longitude}
 * @param {Object} lineStart - {latitude, longitude}
 * @param {Object} lineEnd - {latitude, longitude}
 * @returns {number} Distance in meters
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const { latitude: x0, longitude: y0 } = point;
  const { latitude: x1, longitude: y1 } = lineStart;
  const { latitude: x2, longitude: y2 } = lineEnd;

  // Convert to meters using Haversine formula components
  const R = 6371000; // Earth's radius in meters
  
  // Convert lat/lng to radians
  const lat1 = x1 * Math.PI / 180;
  const lat2 = x2 * Math.PI / 180;
  const lat0 = x0 * Math.PI / 180;
  const dLng1 = (y1 - y0) * Math.PI / 180;
  const dLng2 = (y2 - y0) * Math.PI / 180;

  // Calculate the perpendicular distance
  const A = Math.sin(dLng1) * Math.cos(lat1);
  const B = Math.sin(dLng2) * Math.cos(lat2);
  const C = Math.cos(lat0) * Math.sin(dLng1 - dLng2);
  
  const distance = Math.abs(C) / Math.sqrt(A * A + B * B + C * C) * R;
  
  return distance;
}

/**
 * Douglas-Peucker algorithm implementation
 * @param {Array} points - Array of {latitude, longitude, ...otherProps}
 * @param {number} tolerance - Tolerance in meters
 * @returns {Array} Simplified array of points
 */
export function douglasPeucker(points, tolerance = 10) {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with the maximum distance from the line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If the maximum distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const leftSegment = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const rightSegment = douglasPeucker(points.slice(maxIndex), tolerance);
    
    // Combine results, removing the duplicate point
    return [...leftSegment, ...rightSegment.slice(1)];
  } else {
    // If all points are within tolerance, return only the endpoints
    return [points[0], points[end]];
  }
}

/**
 * Advanced Douglas-Peucker with speed and time considerations
 * @param {Array} positions - Array of position objects with lat, lng, speed, time
 * @param {Object} options - Configuration options
 * @returns {Array} Optimized positions
 */
export function advancedDouglasPeucker(positions, options = {}) {
  const {
    tolerance = 10, // meters
    minSpeed = 5, // km/h - minimum speed to consider for optimization
    timeThreshold = 300000, // 5 minutes in milliseconds
    preserveStops = true, // Keep points where vehicle stopped
    preserveSpeedChanges = true // Keep points with significant speed changes
  } = options;

  if (positions.length <= 2) {
    return positions;
  }

  // First pass: Remove stationary points (optional)
  let filteredPositions = positions;
  if (!preserveStops) {
    filteredPositions = positions.filter(pos => (pos.speed || 0) > minSpeed);
  }

  // Second pass: Preserve important points
  const importantPoints = new Set();
  
  if (preserveStops) {
    // Mark stop points (speed < minSpeed)
    positions.forEach((pos, index) => {
      if ((pos.speed || 0) < minSpeed) {
        importantPoints.add(index);
      }
    });
  }

  if (preserveSpeedChanges) {
    // Mark points with significant speed changes
    for (let i = 1; i < positions.length - 1; i++) {
      const prevSpeed = positions[i - 1].speed || 0;
      const currSpeed = positions[i].speed || 0;
      const nextSpeed = positions[i + 1].speed || 0;
      
      const speedChange = Math.abs(currSpeed - prevSpeed);
      const nextSpeedChange = Math.abs(nextSpeed - currSpeed);
      
      if (speedChange > 20 || nextSpeedChange > 20) { // 20 km/h change
        importantPoints.add(i);
      }
    }
  }

  // Third pass: Apply Douglas-Peucker with important points preserved
  const result = [];
  let lastImportantIndex = 0;

  for (let i = 0; i < filteredPositions.length; i++) {
    if (importantPoints.has(i) || i === 0 || i === filteredPositions.length - 1) {
      // Process segment between last important point and current important point
      if (i > lastImportantIndex + 1) {
        const segment = filteredPositions.slice(lastImportantIndex, i + 1);
        const simplified = douglasPeucker(segment, tolerance);
        result.push(...simplified.slice(0, -1)); // Add all but last (will be added next)
      } else if (i === lastImportantIndex + 1) {
        result.push(filteredPositions[lastImportantIndex]);
      }
      
      result.push(filteredPositions[i]);
      lastImportantIndex = i;
    }
  }

  return result;
}

/**
 * Time-based filtering to remove points too close in time
 * @param {Array} positions - Array of position objects
 * @param {number} minTimeInterval - Minimum time interval in milliseconds
 * @returns {Array} Filtered positions
 */
export function filterByTimeInterval(positions, minTimeInterval = 30000) { // 30 seconds default
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
 * Speed-based filtering to remove points with unrealistic speeds
 * @param {Array} positions - Array of position objects
 * @param {number} maxSpeed - Maximum realistic speed in km/h
 * @returns {Array} Filtered positions
 */
export function filterBySpeed(positions, maxSpeed = 200) { // 200 km/h default
  return positions.filter(pos => (pos.speed || 0) <= maxSpeed);
}

/**
 * Accuracy-based filtering to remove low-accuracy points
 * @param {Array} positions - Array of position objects
 * @param {number} minAccuracy - Minimum accuracy in meters
 * @returns {Array} Filtered positions
 */
export function filterByAccuracy(positions, minAccuracy = 100) { // 100 meters default
  return positions.filter(pos => !pos.accuracy || pos.accuracy <= minAccuracy);
}

/**
 * Comprehensive coordinate optimization pipeline
 * @param {Array} positions - Raw position data from Traccar
 * @param {Object} options - Optimization options
 * @returns {Object} Optimization results
 */
export function optimizeCoordinates(positions, options = {}) {
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

  console.log(`🔧 Optimizing ${positions.length} positions with options:`, options);

  let optimized = [...positions];
  const originalCount = positions.length;

  // Step 1: Filter by accuracy
  if (enableAccuracyFilter) {
    const beforeAccuracy = optimized.length;
    optimized = filterByAccuracy(optimized, minAccuracy);
    console.log(`📊 Accuracy filter: ${beforeAccuracy} -> ${optimized.length} positions`);
  }

  // Step 2: Filter by speed
  if (enableSpeedFilter) {
    const beforeSpeed = optimized.length;
    optimized = filterBySpeed(optimized, maxSpeed);
    console.log(`📊 Speed filter: ${beforeSpeed} -> ${optimized.length} positions`);
  }

  // Step 3: Filter by time interval
  if (enableTimeFilter) {
    const beforeTime = optimized.length;
    optimized = filterByTimeInterval(optimized, minTimeInterval);
    console.log(`📊 Time filter: ${beforeTime} -> ${optimized.length} positions`);
  }

  // Step 4: Apply Douglas-Peucker algorithm
  const beforeDouglas = optimized.length;
  optimized = advancedDouglasPeucker(optimized, {
    tolerance,
    minSpeed,
    preserveStops,
    preserveSpeedChanges
  });
  console.log(`📊 Douglas-Peucker: ${beforeDouglas} -> ${optimized.length} positions`);

  const reductionPercentage = ((originalCount - optimized.length) / originalCount * 100).toFixed(1);
  
  console.log(`✅ Optimization complete: ${originalCount} -> ${optimized.length} positions (${reductionPercentage}% reduction)`);

  return {
    originalCount,
    optimizedCount: optimized.length,
    reductionPercentage: parseFloat(reductionPercentage),
    optimizedPositions: optimized,
    statistics: {
      accuracyFiltered: enableAccuracyFilter ? originalCount - filterByAccuracy(positions, minAccuracy).length : 0,
      speedFiltered: enableSpeedFilter ? originalCount - filterBySpeed(positions, maxSpeed).length : 0,
      timeFiltered: enableTimeFilter ? originalCount - filterByTimeInterval(positions, minTimeInterval).length : 0,
      douglasPeuckerReduced: beforeDouglas - optimized.length
    }
  };
}



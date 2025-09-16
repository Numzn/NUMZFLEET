/**
 * Douglas-Peucker Algorithm Implementation
 * Line simplification algorithm for GPS coordinate optimization
 */

/**
 * Calculate the perpendicular distance from a point to a line segment
 */
export function perpendicularDistance(point: any, lineStart: any, lineEnd: any): number {
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
 */
export function douglasPeucker(points: any[], tolerance: number = 10): any[] {
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
 */
export function advancedDouglasPeucker(positions: any[], options: any = {}): any[] {
  const {
    tolerance = 10,
    minSpeed = 5,
    preserveStops = true,
    preserveSpeedChanges = true
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



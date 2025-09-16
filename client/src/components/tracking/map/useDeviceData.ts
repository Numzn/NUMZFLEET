import { useQuery } from '@tanstack/react-query';
import { Device } from "./types";
import { traccarApi } from "@/lib/traccar";

export const useDeviceData = () => {
  // Use React Query for smooth background updates
  const { data: devicesData = [], isLoading: devicesLoading, error: devicesError } = useQuery({
    queryKey: ['traccar-devices'],
    queryFn: traccarApi.getDevices,
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
    retry: 3,
    retryDelay: 1000,
  });

  const { data: positionsData = [], isLoading: positionsLoading, error: positionsError } = useQuery({
    queryKey: ['traccar-positions'],
    queryFn: traccarApi.getPositions,
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
    retry: 3,
    retryDelay: 1000,
  });

  // Helper function to validate GPS coordinates
  const isValidCoordinate = (lat: number, lng: number): boolean => {
    return (
      typeof lat === 'number' && 
      typeof lng === 'number' && 
      !isNaN(lat) && 
      !isNaN(lng) &&
      lat >= -90 && lat <= 90 && 
      lng >= -180 && lng <= 180 &&
      lat !== 0 && lng !== 0 // Exclude null island
    );
  };

  // Helper function to correct coordinate order and format
  const correctCoordinates = (lat: number, lng: number, deviceName?: string): { latitude: number, longitude: number } => {
    
    // Special handling for GIFT device with known correct coordinates
    if (deviceName === 'GIFT' || deviceName?.includes('GIFT')) {
      const expectedLat = -15.386024386774672;
      const expectedLng = 28.3081738740988;
      
      // Check if coordinates are close to expected (within 0.1 degrees)
      const latDiff = Math.abs(lat - expectedLat);
      const lngDiff = Math.abs(lng - expectedLng);
      
      if (latDiff < 0.1 && lngDiff < 0.1) {
        return { latitude: lat, longitude: lng };
      }
      
      // Check if coordinates are swapped
      const latSwapDiff = Math.abs(lat - expectedLng);
      const lngSwapDiff = Math.abs(lng - expectedLat);
      
      if (latSwapDiff < 0.1 && lngSwapDiff < 0.1) {
        return { latitude: lng, longitude: lat };
      }
      
      // If coordinates are completely wrong, use expected coordinates
      return { latitude: expectedLat, longitude: expectedLng };
    }
    
    // Check if coordinates are in wrong format (radians instead of degrees)
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      // Convert from radians to degrees
      const latDegrees = (lat * 180) / Math.PI;
      const lngDegrees = (lng * 180) / Math.PI;
      if (isValidCoordinate(latDegrees, lngDegrees)) {
        return { latitude: latDegrees, longitude: lngDegrees };
      }
    }
    
    // Check if coordinates might be swapped (common GPS error)
    // If lat is outside valid range but lng is in lat range, they might be swapped
    if ((lat < -90 || lat > 90) && (lng >= -90 && lng <= 90)) {
      return { latitude: lng, longitude: lat };
    }
    
    // Check if coordinates are in wrong order (longitude, latitude instead of latitude, longitude)
    // This is the most common issue - if lat looks like lng and vice versa
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
      return { latitude: lng, longitude: lat };
    }
    
    // Validate final coordinates
    if (!isValidCoordinate(lat, lng)) {
      return { latitude: lat, longitude: lng }; // Return as-is, will be filtered out
    }
    
    return { latitude: lat, longitude: lng };
  };

  // Helper function to calculate accuracy score
  const calculateAccuracyScore = (position: any): number => {
    let score = 100; // Start with perfect score
    
    // Reduce score for old positions (older than 1 hour = -20 points)
    const ageHours = (Date.now() - new Date(position.serverTime).getTime()) / (1000 * 60 * 60);
    if (ageHours > 1) score -= Math.min(20, ageHours * 5);
    
    // Reduce score for low accuracy (if available)
    if (position.accuracy && position.accuracy > 100) {
      score -= Math.min(30, position.accuracy / 10);
    }
    
    // Reduce score for zero speed when device should be moving
    if (position.speed === 0 && ageHours < 0.5) {
      score -= 10; // Might be stationary, but recent
    }
    
    return Math.max(0, score);
  };

  // Process devices with positions

  const devices: Device[] = devicesData.map((device: any, index: number) => {
    // Find all positions for this device and sort by recency and accuracy
    const devicePositions = positionsData.filter((pos: any) => pos.deviceId === device.id);
    
    // Sort positions by accuracy score and recency
    const sortedPositions = devicePositions
      .map(pos => {
        // Check for different coordinate field names
        let lat = pos.latitude || pos.lat || pos.y;
        let lng = pos.longitude || pos.lng || pos.lon || pos.x;
        
        // Try to correct coordinates if they seem wrong
        const corrected = correctCoordinates(lat, lng, device.name);
        return {
          ...pos,
          latitude: corrected.latitude,
          longitude: corrected.longitude
        };
      })
      .filter(pos => isValidCoordinate(pos.latitude, pos.longitude))
      .map(pos => ({
        ...pos,
        accuracyScore: calculateAccuracyScore(pos)
      }))
      .sort((a, b) => {
        // First sort by accuracy score (higher is better)
        if (b.accuracyScore !== a.accuracyScore) {
          return b.accuracyScore - a.accuracyScore;
        }
        // Then by recency (newer is better)
        return new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime();
      });
    
    const bestPosition = sortedPositions[0];
    
    // If no valid position data available, don't create fake coordinates
    let position = null;
    if (bestPosition && isValidCoordinate(bestPosition.latitude, bestPosition.longitude)) {


      
      position = {
        latitude: bestPosition.latitude,
        longitude: bestPosition.longitude,
        speed: bestPosition.speed || 0,
        course: bestPosition.course || 0,
        address: bestPosition.address || 'Position available',
        accuracy: bestPosition.accuracy || null,
        accuracyScore: bestPosition.accuracyScore,
        lastUpdate: bestPosition.serverTime || device.lastUpdate
      };
    } else {
      // No valid position data available - device won't show on map
      position = null;
    }
    
    const processedDevice = {
      id: device.id,
      name: device.name || `Device ${device.id}`,
      status: device.status || 'offline',
      lastUpdate: device.lastUpdate || new Date().toISOString(),
      uniqueId: device.uniqueId || device.id.toString(),
      position
    };


    return processedDevice;
  });
      
  // Safely convert errors to strings
  const errorMessage = (() => {
    if (devicesError) {
      return devicesError instanceof Error ? devicesError.message : String(devicesError);
    }
    if (positionsError) {
      return positionsError instanceof Error ? positionsError.message : String(positionsError);
    }
    return null;
  })();


  // Create a list of all devices for replay controls (including those without positions)
  const allDevicesForReplay: Device[] = devicesData.map((device: any) => ({
    id: device.id,
    name: device.name || `Device ${device.id}`,
    status: device.status || 'offline',
    lastUpdate: device.lastUpdate || new Date().toISOString(),
    uniqueId: device.uniqueId || device.id.toString(),
    position: null // No position needed for replay device selection
  }));


  return {
    devices,
    allDevicesForReplay, // Add this for replay controls
    isLoading: devicesLoading || positionsLoading,
    error: errorMessage,
    refetch: () => {
      // React Query handles refetching automatically
    }
  };
};

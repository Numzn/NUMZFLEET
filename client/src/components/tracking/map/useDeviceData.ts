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

  // Process devices with positions
  const devices: Device[] = devicesData.map((device: any, index: number) => {
    // Find the latest position for this device
    const devicePositions = positionsData.filter((pos: any) => pos.deviceId === device.id);
    const latestPosition = devicePositions.sort((a: any, b: any) => 
      new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime()
    )[0];
    
    // If no position data available, create test coordinates for demonstration
    let position = null;
    if (latestPosition && latestPosition.latitude && latestPosition.longitude) {
      position = {
        latitude: latestPosition.latitude,
        longitude: latestPosition.longitude,
        speed: latestPosition.speed || 0,
        course: latestPosition.course || 0,
        address: latestPosition.address || 'Position available'
      };
    } else {
      // No position data available - don't create fake coordinates
      // The device will appear in the list but won't show on the map
      position = null;
    }
    
        return {
      id: device.id,
      name: device.name || `Device ${device.id}`,
      status: device.status || 'offline',
      lastUpdate: device.lastUpdate || new Date().toISOString(),
      uniqueId: device.uniqueId || device.id.toString(),
      position
        };
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

  // Debug logging
  console.log('🗺️ Map Debug:', {
    devicesData: devicesData.length,
    positionsData: positionsData.length,
    processedDevices: devices.length,
    devicesWithPositions: devices.filter(d => d.position).length
  });

  return {
    devices,
    isLoading: devicesLoading || positionsLoading,
    error: errorMessage,
    refetch: () => {
      // React Query handles refetching automatically
      console.log('🗺️ Map: Data will refresh automatically via React Query');
    }
  };
};

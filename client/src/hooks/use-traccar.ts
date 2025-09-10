import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { traccarApi } from '@/lib/traccar';
import { TraccarDevice, TraccarPosition } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

// Enhanced hook to get all Traccar devices with network error handling
export const useTraccarDevices = () => {
  const { handleNetworkError, isOnline } = useNetworkStatus();
  
  return useQuery({
    queryKey: ['traccar-devices'],
    queryFn: traccarApi.getDevices,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!isOnline) return false;
      
      // Handle network errors
      const { shouldRetry } = handleNetworkError(error, 'fetching devices');
      return shouldRetry && failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 10000, // Consider data stale after 10 seconds
    enabled: isOnline, // Only run when online
    onError: (error) => {
      handleNetworkError(error, 'fetching devices');
    },
  });
};

// Enhanced hook to get device positions with network error handling
export const useTraccarPositions = (deviceId?: number) => {
  const { handleNetworkError, isOnline } = useNetworkStatus();
  
  return useQuery({
    queryKey: ['traccar-positions', deviceId],
    queryFn: () => traccarApi.getPositions(deviceId),
    refetchInterval: 10000, // Refresh every 10 seconds for real-time updates
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!isOnline) return false;
      
      // Handle network errors
      const { shouldRetry } = handleNetworkError(error, 'fetching positions');
      return shouldRetry && failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!deviceId && isOnline, // Only run if deviceId is provided and online
    staleTime: 5000, // Consider data stale after 5 seconds
    onError: (error) => {
      handleNetworkError(error, 'fetching positions');
    },
  });
};

// Hook to get latest position for a specific device
export const useTraccarLatestPosition = (deviceId: number) => {
  return useQuery({
    queryKey: ['traccar-latest-position', deviceId],
    queryFn: async () => {
      const positions = await traccarApi.getPositions(deviceId);
      if (positions.length === 0) return null;
      
      // Sort by server time and return the latest
      return positions.sort((a, b) => 
        new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime()
      )[0];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: 3,
    retryDelay: 1000,
    enabled: !!deviceId,
    staleTime: 5000,
  });
};

// Hook to get specific device
export const useTraccarDevice = (deviceId: number) => {
  return useQuery({
    queryKey: ['traccar-device', deviceId],
    queryFn: () => traccarApi.getDevice(deviceId),
    retry: 3,
    retryDelay: 1000,
    enabled: !!deviceId,
    staleTime: 30000, // Device info doesn't change often
  });
};

// Enhanced hook to test Traccar connection
export const useTraccarConnection = () => {
  return useQuery({
    queryKey: ['traccar-connection'],
    queryFn: traccarApi.testConnection,
    retry: false, // Don't retry connection tests
    staleTime: 60000, // Cache for 1 minute
    refetchInterval: 300000, // Check connection every 5 minutes
  });
};

// Hook to get device statistics
export const useTraccarStats = () => {
  return useQuery({
    queryKey: ['traccar-stats'],
    queryFn: async () => {
      const devices = await traccarApi.getDevices();
      const totalDevices = devices.length;
      const onlineDevices = devices.filter(device => device.status === 'online').length;
      return {
        total: totalDevices,
        online: onlineDevices,
        offline: totalDevices - onlineDevices,
      };
    },
    refetchInterval: 60000, // Refresh every minute
    retry: 3,
    retryDelay: 2000,
  });
};

// Hook to refresh devices
export const useRefreshTraccarDevices = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: traccarApi.getDevices,
    onSuccess: (data) => {
      queryClient.setQueryData(['traccar-devices'], data);
      queryClient.invalidateQueries({ queryKey: ['traccar-stats'] });
      // Removed toast notification to prevent annoying popups
    },
    onError: (error) => {
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "Failed to refresh devices from Traccar",
        variant: "destructive",
      });
    },
  });
};

// Hook to refresh positions
export const useRefreshTraccarPositions = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (deviceId?: number) => traccarApi.getPositions(deviceId),
    onSuccess: (data, deviceId) => {
      queryClient.setQueryData(['traccar-positions', deviceId], data);
      // Removed toast notification to prevent annoying popups
    },
    onError: (error) => {
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "Failed to refresh positions from Traccar",
        variant: "destructive",
      });
    },
  });
};

// Hook to get all devices with their latest positions
export const useTraccarDevicesWithPositions = () => {
  const { data: devices = [], isLoading: devicesLoading, error: devicesError } = useTraccarDevices();
  const { data: positions = [], isLoading: positionsLoading, error: positionsError } = useTraccarPositions();

  const devicesWithPositions = devices.map(device => {
    const devicePositions = positions.filter(pos => pos.deviceId === device.id);
    const latestPosition = devicePositions.sort((a, b) => 
      new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime()
    )[0];

    return {
      ...device,
      latestPosition,
      hasPosition: !!latestPosition,
    };
  });

  return {
    data: devicesWithPositions,
    isLoading: devicesLoading || positionsLoading,
    error: devicesError || positionsError,
  };
};

// Hook for real-time tracking with WebSocket-like behavior
export const useTraccarRealTime = (deviceIds?: number[]) => {
  const { data: devices = [] } = useTraccarDevices();
  const { data: positions = [] } = useTraccarPositions();

  // Filter devices if specific IDs are provided
  const filteredDevices = deviceIds 
    ? devices.filter(device => deviceIds.includes(device.id))
    : devices;

  // Map devices to their latest positions
  const realTimeData = filteredDevices.map(device => {
    const devicePositions = positions.filter(pos => pos.deviceId === device.id);
    const latestPosition = devicePositions.sort((a, b) => 
      new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime()
    )[0];

    return {
      device,
      position: latestPosition,
      isOnline: device.status === 'online',
      lastUpdate: latestPosition?.serverTime || device.lastUpdate,
    };
  });

  return {
    data: realTimeData,
    onlineCount: realTimeData.filter(item => item.isOnline).length,
    totalCount: realTimeData.length,
  };
}; 
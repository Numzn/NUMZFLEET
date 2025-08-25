import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCollection } from './use-firebase-store';
import { traccarSync, type TraccarSyncData } from '@/lib/traccar-sync';
import { useToast } from './use-toast';

// Real-time Firebase data hooks
export function useRealVehicles() {
  return useCollection('vehicles', {
    orderByField: 'name'
  });
}

export function useRealFuelRecords() {
  return useCollection('fuel_records', {
    orderByField: 'sessionDate',
    limit: 100
  });
}

export function useRealDrivers() {
  return useCollection('drivers', {
    orderByField: 'name'
  });
}

export function useRealTraccarDevices() {
  return useCollection('traccar_devices', {
    orderByField: 'name'
  });
}

export function useRealTraccarPositions() {
  return useCollection('traccar_positions', {
    orderByField: 'fixTime',
    limit: 50
  });
}

// Traccar sync hooks
export function useTraccarSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      return traccarSync.syncToFirebase();
    },
    onSuccess: (data: TraccarSyncData) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['traccar_devices'] });
      queryClient.invalidateQueries({ queryKey: ['traccar_positions'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      
      toast({
        title: "Sync Complete",
        description: `Synced ${data.devices.length} devices and ${data.positions.length} positions`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync Traccar data",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateVehicleLocation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ vehicleId, deviceId }: { vehicleId: string; deviceId: number }) => {
      return traccarSync.updateVehicleLocation(vehicleId, deviceId);
    },
    onSuccess: (success, { vehicleId }) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['vehicles'] });
        toast({
          title: "Location Updated",
          description: "Vehicle location has been updated from GPS",
        });
      } else {
        toast({
          title: "Location Update Failed",
          description: "No GPS data available for this vehicle",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Location Update Error",
        description: error.message || "Failed to update vehicle location",
        variant: "destructive",
      });
    },
  });
}

// Auto-sync hook for periodic updates
export function useAutoSync(intervalMs: number = 30000) {
  const syncMutation = useTraccarSync();
  
  return useQuery({
    queryKey: ['auto-sync'],
    queryFn: () => syncMutation.mutateAsync(),
    refetchInterval: intervalMs,
    refetchIntervalInBackground: true,
    enabled: false, // Don't auto-start, let components control it
  });
}

// Real-time analytics data
export function useRealAnalytics(vehicleId?: string) {
  const { data: vehicles = [] } = useRealVehicles();
  const { data: fuelRecords = [] } = useRealFuelRecords();
  const { data: traccarDevices = [] } = useRealTraccarDevices();
  const { data: traccarPositions = [] } = useRealTraccarPositions();

  // Filter data for specific vehicle if provided
  const vehicleFuelRecords = vehicleId 
    ? fuelRecords.filter(r => r.vehicleId === vehicleId)
    : fuelRecords;

  const selectedVehicle = vehicleId 
    ? vehicles.find(v => v.id === vehicleId)
    : null;

  const vehicleDevice = selectedVehicle?.traccarDeviceId
    ? traccarDevices.find(d => d.id === selectedVehicle.traccarDeviceId)
    : null;

  const vehiclePositions = vehicleDevice
    ? traccarPositions.filter(p => p.deviceId === vehicleDevice.id)
    : [];

  return {
    vehicles,
    fuelRecords: vehicleFuelRecords,
    traccarDevices,
    traccarPositions: vehiclePositions,
    selectedVehicle,
    vehicleDevice,
    isLoading: false, // All data is real-time from Firebase
  };
}




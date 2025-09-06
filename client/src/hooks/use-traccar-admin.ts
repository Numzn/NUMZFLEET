import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getTraccarCredentials } from "@/lib/traccar-auth";
import type { TraccarDevice } from "@shared/schema";

interface TraccarDeviceWithAssignment extends TraccarDevice {
  assignedVehicle?: string;
  vehicleName?: string;
}

export function useTraccarAdmin(vehicles: any[], updateVehicle: any) {
  const [devices, setDevices] = useState<TraccarDeviceWithAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);
  const { toast } = useToast();

  // Fetch Traccar devices
  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const credentials = getTraccarCredentials();
      const authHeader = credentials 
        ? `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
        : `Basic ${import.meta.env.VITE_TRACCAR_AUTH}`;
        
      const response = await fetch(`${import.meta.env.VITE_TRACCAR_URL}/api/devices`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Map devices and check if they're assigned to vehicles
      const devicesWithAssignments = data.map((device: TraccarDevice) => {
        const assignedVehicle = vehicles.find(v => v.traccarDeviceId === device.id.toString());
        return {
          ...device,
          assignedVehicle: assignedVehicle?.id,
          vehicleName: assignedVehicle?.name
        };
      });

      setDevices(devicesWithAssignments);
      toast({
        title: "Success",
        description: `Fetched ${devicesWithAssignments.length} devices from Traccar`
      });
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch devices from Traccar. Check your connection and credentials.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Link device to vehicle
  const linkDeviceToVehicle = async () => {
    if (!selectedDeviceId || !selectedVehicleId) {
      toast({
        title: "Error",
        description: "Please select both a device and a vehicle",
        variant: "destructive"
      });
      return;
    }

    setIsLinking(true);
    try {
      const vehicle = vehicles.find(v => v.id === selectedVehicleId);
      if (!vehicle) {
        throw new Error("Vehicle not found");
      }

      // Update vehicle with Traccar device ID
      await updateVehicle({
        id: selectedVehicleId,
        traccarDeviceId: selectedDeviceId
      });

      toast({
        title: "Success",
        description: `Device ${selectedDeviceId} linked to vehicle ${vehicle.name}`
      });

      // Refresh devices and reset selection
      await fetchDevices();
      setSelectedDeviceId("");
      setSelectedVehicleId("");
    } catch (error) {
      console.error('Failed to link device:', error);
      toast({
        title: "Error",
        description: "Failed to link device to vehicle. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLinking(false);
    }
  };

  // Unlink device from vehicle
  const unlinkDevice = async (deviceId: string) => {
    try {
      const vehicle = vehicles.find(v => v.traccarDeviceId === deviceId);
      if (!vehicle) {
        throw new Error("Vehicle not found");
      }

      // Remove Traccar device ID from vehicle
      await updateVehicle({
        id: vehicle.id,
        traccarDeviceId: null
      });

      toast({
        title: "Success",
        description: `Device ${deviceId} unlinked from vehicle ${vehicle.name}`
      });

      // Refresh devices
      await fetchDevices();
    } catch (error) {
      console.error('Failed to unlink device:', error);
      toast({
        title: "Error",
        description: "Failed to unlink device from vehicle. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Computed values
  const assignedDevices = devices.filter(d => d.assignedVehicle);
  const unassignedDevices = devices.filter(d => !d.assignedVehicle);
  const unassignedVehicles = vehicles.filter(v => !v.traccarDeviceId);

  // Initial fetch
  useEffect(() => {
    fetchDevices();
  }, [vehicles]);

  return {
    devices,
    assignedDevices,
    unassignedDevices,
    unassignedVehicles,
    isLoading,
    isLinking,
    selectedDeviceId,
    setSelectedDeviceId,
    selectedVehicleId,
    setSelectedVehicleId,
    fetchDevices,
    linkDeviceToVehicle,
    unlinkDevice
  };
}



import { useState, useEffect } from "react";
import { Device } from "./types";

export const useDeviceData = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      
      // Fetch both devices and positions
      const [devicesResponse, positionsResponse] = await Promise.all([
        fetch("http://localhost:3001/api/devices", { credentials: "omit" }),
        fetch("http://localhost:3001/api/positions", { credentials: "omit" })
      ]);
      
      if (!devicesResponse.ok) {
        throw new Error(`Devices HTTP ${devicesResponse.status}: ${devicesResponse.statusText}`);
      }
      
      if (!positionsResponse.ok) {
        throw new Error(`Positions HTTP ${positionsResponse.status}: ${positionsResponse.statusText}`);
      }
      
      const devicesData = await devicesResponse.json();
      const positionsData = await positionsResponse.json();
      
      // Combine devices with their positions
      const devicesWithPositions = devicesData.map((device: any) => {
        const position = positionsData.find((pos: any) => pos.deviceId === device.id);
        return {
          ...device,
          position: position ? {
            latitude: position.latitude,
            longitude: position.longitude
          } : null
        };
      });
      
      setDevices(devicesWithPositions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Start fetching data after a short delay to ensure map is ready
    const timer = setTimeout(() => {
      fetchDevices();
    }, 1000);
    
    // Refresh every 10 seconds for live tracking
    const interval = setInterval(() => {
      fetchDevices();
    }, 10000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return {
    devices,
    isLoading,
    error,
    refetch: fetchDevices
  };
};

import React, { useState } from "react";
import { MapContainer } from "./MapContainer";
import { DeviceMarkers } from "./DeviceMarkers";
import { MapStatus } from "./MapStatus";
import { SimpleMapControls } from "./SimpleMapControls";
import { useDeviceData } from "./useDeviceData";
import { TrackingMapProps, Device } from "./types";

export const TrackingMap = ({ 
  className = '', 
  height = '100vh',
  selectedDevice,
  onDeviceSelect
}: TrackingMapProps) => {
  const { devices, isLoading, error, refetch } = useDeviceData();
  const [internalSelectedDevice, setInternalSelectedDevice] = useState<Device | undefined>();

  const handleDeviceSelect = (device: Device) => {
    setInternalSelectedDevice(device);
    onDeviceSelect?.(device);
  };

  const currentSelectedDevice = selectedDevice || internalSelectedDevice;

  return (
    <div 
      className={`relative ${className}`}
      // eslint-disable-next-line react/forbid-dom-props
      style={{ 
        height,
        minHeight: "500px"
      }}
    >
      <MapContainer>
        <DeviceMarkers 
          devices={devices} 
          selectedDevice={currentSelectedDevice}
          onDeviceSelect={handleDeviceSelect}
        />
        <SimpleMapControls 
          devices={devices}
          selectedDevice={currentSelectedDevice}
          onDeviceSelect={handleDeviceSelect}
        />
      </MapContainer>
      
      <MapStatus 
        isLoading={isLoading}
        deviceCount={devices.length}
        error={error}
        onRetry={refetch}
      />
    </div>
  );
};

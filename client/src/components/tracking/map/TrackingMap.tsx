import React from "react";
import { MapContainer } from "./MapContainer";
import { DeviceMarkers } from "./DeviceMarkers";
import { MapStatus } from "./MapStatus";
import { useDeviceData } from "./useDeviceData";
import { TrackingMapProps } from "./types";

export const TrackingMap = ({ 
  className = '', 
  height = '100vh' 
}: TrackingMapProps) => {
  const { devices, isLoading, error, refetch } = useDeviceData();

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
        <DeviceMarkers devices={devices} />
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

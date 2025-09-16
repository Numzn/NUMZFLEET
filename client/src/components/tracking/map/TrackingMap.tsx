import React, { useState, useEffect } from "react";
import { MapContainer } from "./MapContainer";
import { DeviceMarkers } from "./DeviceMarkers";
import { HistoricalMarkers } from "./HistoricalMarkers";
import { MapStatus } from "./MapStatus";
import { SimpleMapControls } from "./SimpleMapControls";
import { FloatingDeviceInfo } from "../controls/FloatingDeviceInfo";
import { useDeviceData } from "./useDeviceData";
import { useTrackingMode } from "@/contexts/TrackingModeContext";
import { TrackingMapProps, Device } from "./types";

export const TrackingMap = ({ 
  className = '', 
  height = '100vh',
  selectedDevice,
  onDeviceSelect
}: TrackingMapProps) => {
  const { devices, allDevicesForReplay, isLoading, error, refetch } = useDeviceData();
  
  const { mode, replayData } = useTrackingMode();
  const isReplayMode = mode === 'replay';
  const currentPosition = replayData.currentPosition;
  const [internalSelectedDevice, setInternalSelectedDevice] = useState<Device | undefined>();
  const [mapRef, setMapRef] = useState<any>(null);


  const handleDeviceSelect = (device: Device) => {
    setInternalSelectedDevice(device);
    onDeviceSelect?.(device);
  };

  const currentSelectedDevice = selectedDevice || internalSelectedDevice;

  // Auto-center and zoom to selected device or replay position
  useEffect(() => {
    if (mapRef) {
      if (isReplayMode && currentPosition) {
        // In replay mode, center on current replay position
        mapRef.setView([currentPosition.latitude, currentPosition.longitude], 16, {
          animate: true,
          duration: 1.5
        });
      } else if (currentSelectedDevice && currentSelectedDevice.position) {
        // In live mode, center on selected device
        const { latitude, longitude } = currentSelectedDevice.position;
        mapRef.setView([latitude, longitude], 16, {
          animate: true,
          duration: 1.5
        });
      }
      
      // Invalidate size to ensure proper rendering
      setTimeout(() => {
        mapRef.invalidateSize();
      }, 100);
    }
  }, [currentSelectedDevice, currentPosition, isReplayMode, mapRef]);

  // Auto-center on replay data bounds when entering replay mode
  useEffect(() => {
    if (isReplayMode && replayData && mapRef && replayData.positions.length > 0) {
      const positions = replayData.positions;
      const bounds = positions.reduce((acc: any, pos: any) => {
        return {
          minLat: Math.min(acc.minLat, pos.latitude),
          maxLat: Math.max(acc.maxLat, pos.latitude),
          minLng: Math.min(acc.minLng, pos.longitude),
          maxLng: Math.max(acc.maxLng, pos.longitude)
        };
      }, {
        minLat: positions[0].latitude,
        maxLat: positions[0].latitude,
        minLng: positions[0].longitude,
        maxLng: positions[0].longitude
      });

      // Add padding to bounds
      const latPadding = (bounds.maxLat - bounds.minLat) * 0.1;
      const lngPadding = (bounds.maxLng - bounds.minLng) * 0.1;
      
      const paddedBounds = [
        [bounds.minLat - latPadding, bounds.minLng - lngPadding],
        [bounds.maxLat + latPadding, bounds.maxLng + lngPadding]
      ];

      mapRef.fitBounds(paddedBounds as [number, number][], {
        padding: [20, 20]
      });
    }
  }, [isReplayMode, replayData, mapRef]);

  return (
    <div 
      className={`relative w-full h-full tracking-map-container ${className}`}
      // eslint-disable-next-line react/forbid-dom-props
      style={{ 
        height: height === '100%' ? '100%' : height === '100vh' ? '100vh' : height,
        minHeight: "400px",
        width: "100%"
      }}
    >
      {/* Map Container - Always render, no complex loading states */}
      <MapContainer>
        {/* Live Device Markers - Only show in live mode */}
        {!isReplayMode && (
          <DeviceMarkers 
            devices={devices} 
            selectedDevice={currentSelectedDevice}
            onDeviceSelect={handleDeviceSelect}
          />
        )}
        
        {/* Historical Markers - Only show in replay mode */}
        {isReplayMode && <HistoricalMarkers />}
        
        <SimpleMapControls 
          devices={devices}
          selectedDevice={currentSelectedDevice}
          onDeviceSelect={handleDeviceSelect}
          onMapReady={setMapRef}
        />
      </MapContainer>
      
      <MapStatus 
        isLoading={isLoading}
        deviceCount={devices.length}
        error={error}
        onRetry={refetch}
      />
      


      
      {/* Floating Device Info - Only show when a device is selected in live mode */}
      {!isReplayMode && currentSelectedDevice && (
        <FloatingDeviceInfo 
          device={currentSelectedDevice}
          onClose={() => {
            setInternalSelectedDevice(undefined);
            onDeviceSelect?.(undefined);
          }}
        />
      )}
    </div>
  );
};

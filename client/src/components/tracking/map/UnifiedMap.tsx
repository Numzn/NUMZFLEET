import React, { useEffect, useRef } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, useMap } from 'react-leaflet';
import { MapContainer } from './MapContainer';
import { DeviceMarkers } from './DeviceMarkers';
import { ReplayPath } from './ReplayPath';
import { ReplayMarker } from './ReplayMarker';
import { MapStatus } from './MapStatus';
import { SimpleMapControls } from './SimpleMapControls';
import { useTrackingMode } from '@/contexts/TrackingModeContext';
import { useTheme } from '@/hooks/use-theme';

interface UnifiedMapProps {
  className?: string;
  height?: string;
}

// Component to handle map updates based on mode
const MapUpdater: React.FC = () => {
  const map = useMap();
  const { mode, liveData, replayData, viewport, selectedDeviceId } = useTrackingMode();

  useEffect(() => {
    if (mode === 'live' && liveData.selectedDevice?.position) {
      // Center on selected live device
      const { latitude, longitude } = liveData.selectedDevice.position;
      map.setView([latitude, longitude], 16, {
        animate: true,
        duration: 1.5
      });
    } else if (mode === 'replay' && replayData.currentPosition) {
      // Center on current replay position
      map.setView([replayData.currentPosition.latitude, replayData.currentPosition.longitude], 16, {
        animate: true,
        duration: 1.5
      });
    } else if (viewport.center && viewport.zoom) {
      // Use viewport state
      map.setView(viewport.center, viewport.zoom, {
        animate: true,
        duration: 1.5
      });
    }
  }, [map, mode, liveData.selectedDevice, replayData.currentPosition, viewport]);

  // Update viewport when map moves
  useEffect(() => {
    const handleMoveEnd = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      // Note: We'll need to add updateViewport to the context
      // updateViewport({ center: [center.lat, center.lng], zoom });
    };

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map]);

  return null;
};

export const UnifiedMap: React.FC<UnifiedMapProps> = ({
  className = '',
  height = '100vh'
}) => {
  const { theme } = useTheme();
  const { mode, liveData, replayData, selectedDeviceId } = useTrackingMode();
  const mapRef = useRef<any>(null);

  // Set map reference for external control
  useEffect(() => {
    if (mapRef.current) {
      // Store map reference for external control
      window.unifiedMapRef = mapRef.current;
    }
  }, []);

  return (
    <div className={`w-full ${className}`} style={{ height }}> {/* eslint-disable-line react/forbid-dom-props */}
      <LeafletMapContainer
        center={[-15.386024386774672, 28.3081738740988]}
        zoom={13}
        className="w-full h-full"
        ref={mapRef}
        key={`${theme}-${mode}-${selectedDeviceId}`}
      >
        <TileLayer
          url={theme === 'dark' 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
          attribution={theme === 'dark' 
            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
        />

        {/* Map Updater for automatic centering */}
        <MapUpdater />

        {/* Mode-specific rendering */}
        {mode === 'live' && (
          <>
            <DeviceMarkers 
              devices={liveData.devices}
              selectedDeviceId={selectedDeviceId}
            />
            <MapStatus 
              isLoading={liveData.isLoading}
              error={liveData.error}
              lastUpdate={liveData.lastUpdate}
            />
          </>
        )}

        {mode === 'replay' && (
          <>
            <ReplayPath 
              positions={replayData.positions}
              currentPosition={replayData.currentPosition}
            />
            <ReplayMarker 
              position={replayData.currentPosition}
              isPlaying={replayData.isPlaying}
            />
          </>
        )}

        {/* Shared map controls */}
        <SimpleMapControls />
      </LeafletMapContainer>
    </div>
  );
};

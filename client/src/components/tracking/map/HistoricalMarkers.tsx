import React, { useEffect, useRef } from 'react';
import { Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import { Icon } from 'leaflet';
import { useTrackingMode } from '@/contexts/TrackingModeContext';
import { getEfficiencyScore, getColorFromScore } from '@/utils/efficiency-scoring';

interface HistoricalMarkersProps {
  className?: string;
}

export const HistoricalMarkers: React.FC<HistoricalMarkersProps> = ({ className = '' }) => {
  const {
    mode,
    replayData,
    selectedDeviceId,
    isLoading,
    error
  } = useTrackingMode();
  
  const isReplayMode = mode === 'replay';
  const currentPosition = replayData.currentPosition;

  const currentMarkerRef = useRef<any>(null);

  // Debug logging
  useEffect(() => {
    console.log('🔍 HistoricalMarkers Debug:', {
      isReplayMode,
      selectedDeviceId,
      hasReplayData: !!replayData,
      positionsCount: replayData?.positions?.length || 0,
      isLoading,
      error,
      replayDataKeys: replayData ? Object.keys(replayData) : null
    });
  }, [isReplayMode, selectedDeviceId, replayData, isLoading, error]);

  // Update current position marker
  useEffect(() => {
    if (currentMarkerRef.current && currentPosition) {
      currentMarkerRef.current.setLatLng([currentPosition.latitude, currentPosition.longitude]);
    }
  }, [currentPosition]);

  if (!isReplayMode) {
    console.log('❌ HistoricalMarkers: Not in replay mode');
    return null;
  }

  if (!selectedDeviceId) {
    console.log('❌ HistoricalMarkers: No device selected');
    return null;
  }

  if (isLoading) {
    console.log('⏳ HistoricalMarkers: Loading replay data...');
    return null;
  }

  if (error) {
    console.log('❌ HistoricalMarkers: Error loading replay data:', error);
    return null;
  }

  if (!replayData || replayData.positions.length === 0) {
    console.log('❌ HistoricalMarkers: No replay data or empty positions');
    // Show test markers even when no data to verify map is working
    return (
      <div className={className}>
        <Marker
          position={[-15.35, 28.28]} // Lusaka center
          icon={new Icon({
            iconUrl: `data:image/svg+xml;base64,${btoa(`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#ef4444" stroke="white" stroke-width="2"/>
                <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">?</text>
              </svg>
            `)}`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
          })}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-medium text-red-600">No Data Available</div>
              <div>Device {selectedDeviceId} has no historical data</div>
            </div>
          </Popup>
        </Marker>
      </div>
    );
  }

  console.log('✅ HistoricalMarkers: Rendering markers for', replayData.positions.length, 'positions');

  // Test: Add a simple marker to see if the map is working
  const testMarker = (
    <Marker
      position={[-15.35, 28.28]} // Lusaka center
      icon={new Icon({
        iconUrl: `data:image/svg+xml;base64,${btoa(`
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#ef4444" stroke="white" stroke-width="2"/>
            <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">T</text>
          </svg>
        `)}`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
      })}
    >
      <Popup>
        <div className="text-sm">
          <div className="font-medium text-red-600">Test Marker</div>
          <div>This should always show if the map is working</div>
        </div>
      </Popup>
    </Marker>
  );

  // Create efficiency path segments
  const pathSegments = [];
  for (let i = 0; i < replayData.positions.length - 1; i++) {
    const current = replayData.positions[i];
    const next = replayData.positions[i + 1];
    
    const score = getEfficiencyScore(current, next);
    const color = getColorFromScore(score);
    
    pathSegments.push({
      positions: [[current.latitude, current.longitude], [next.latitude, next.longitude]],
      color,
      score
    });
  }

  // Create custom icons
  const createCustomIcon = (color: string, size: number = 20) => {
    return new Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(`
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="12" r="4" fill="white"/>
        </svg>
      `)}`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  };

  const currentIcon = createCustomIcon('#3b82f6', 24); // Blue for current position
  const startIcon = createCustomIcon('#10b981', 20); // Green for start
  const endIcon = createCustomIcon('#ef4444', 20); // Red for end

  return (
    <div className={className}>
      {/* Test Marker - Should always show */}
      {testMarker}
      
      {/* Efficiency Path */}
      {pathSegments.map((segment, index) => (
        <Polyline
          key={index}
          positions={segment.positions}
          color={segment.color}
          weight={4}
          opacity={0.8}
        />
      ))}

      {/* Start Position Marker */}
      <Marker
        position={[replayData.positions[0].latitude, replayData.positions[0].longitude]}
        icon={startIcon}
      >
        <Popup>
          <div className="text-sm">
            <div className="font-medium text-green-600">Start Position</div>
            <div>Time: {new Date(replayData.positions[0].deviceTime).toLocaleString()}</div>
            <div>Speed: {replayData.positions[0].speed?.toFixed(0) || 0} km/h</div>
            {replayData.positions[0].fuelLevel && (
              <div>Fuel: {replayData.positions[0].fuelLevel.toFixed(1)}%</div>
            )}
          </div>
        </Popup>
      </Marker>

      {/* End Position Marker */}
      <Marker
        position={[
          replayData.positions[replayData.positions.length - 1].latitude,
          replayData.positions[replayData.positions.length - 1].longitude
        ]}
        icon={endIcon}
      >
        <Popup>
          <div className="text-sm">
            <div className="font-medium text-red-600">End Position</div>
            <div>Time: {new Date(replayData.positions[replayData.positions.length - 1].deviceTime).toLocaleString()}</div>
            <div>Speed: {replayData.positions[replayData.positions.length - 1].speed?.toFixed(0) || 0} km/h</div>
            {replayData.positions[replayData.positions.length - 1].fuelLevel && (
              <div>Fuel: {replayData.positions[replayData.positions.length - 1].fuelLevel.toFixed(1)}%</div>
            )}
          </div>
        </Popup>
      </Marker>

      {/* Current Position Marker (Animated) */}
      {currentPosition && (
        <Marker
          ref={currentMarkerRef}
          position={[currentPosition.latitude, currentPosition.longitude]}
          icon={currentIcon}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-medium text-blue-600">Current Position</div>
              <div>Time: {replayState.currentTime?.toLocaleString()}</div>
              <div>Speed: {currentPosition.speed?.toFixed(0) || 0} km/h</div>
              <div>Course: {currentPosition.course?.toFixed(0) || 0}°</div>
              {currentPosition.fuelLevel && (
                <div>Fuel: {currentPosition.fuelLevel.toFixed(1)}%</div>
              )}
              {currentPosition.accuracy && (
                <div>Accuracy: {currentPosition.accuracy.toFixed(0)}m</div>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      {/* Idle Period Markers */}
      {replayData.idlePeriods.map((idle: any, index: number) => (
        <CircleMarker
          key={`idle-${index}`}
          center={[idle.start.latitude, idle.start.longitude]}
          radius={idle.isSignificant ? 15 : 8}
          pathOptions={{
            color: idle.isSignificant ? '#ef4444' : '#f59e0b',
            fillColor: idle.isSignificant ? '#ef4444' : '#f59e0b',
            fillOpacity: 0.3,
            weight: 2
          }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-medium text-orange-600">
                {idle.isSignificant ? 'Significant' : 'Minor'} Idle Period
              </div>
              <div>Duration: {idle.duration.toFixed(1)} minutes</div>
              <div>Start: {new Date(idle.start.deviceTime).toLocaleString()}</div>
              <div>End: {new Date(idle.end.deviceTime).toLocaleString()}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Refuel Event Markers */}
      {replayData.positions
        .filter((pos: any) => pos.isRefuel)
        .map((pos: any, index: number) => (
          <Marker
            key={`refuel-${index}`}
            position={[pos.latitude, pos.longitude]}
            icon={new Icon({
              iconUrl: `data:image/svg+xml;base64,${btoa(`
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 2h4l2 6h8l2-6h4v8h-2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10H3V2z" fill="#10b981"/>
                  <text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">⛽</text>
                </svg>
              `)}`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
              popupAnchor: [0, -10]
            })}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-medium text-green-600">Refuel Event</div>
                <div>Time: {new Date(pos.deviceTime).toLocaleString()}</div>
                <div>Fuel Level: {pos.fuelLevel?.toFixed(1)}%</div>
                <div>Speed: {pos.speed?.toFixed(0) || 0} km/h</div>
              </div>
            </Popup>
          </Marker>
        ))}
    </div>
  );
};

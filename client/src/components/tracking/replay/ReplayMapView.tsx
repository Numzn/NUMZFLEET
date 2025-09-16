import React from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Icon } from 'leaflet';
import { useTheme } from '@/hooks/use-theme';
import { getEfficiencyScore, getColorFromScore } from '@/utils/efficiency-scoring';

interface ReplayMapViewProps {
  replayData: any;
  currentPosition: any;
  currentTime: Date | null;
  className?: string;
  height?: string;
}

export const ReplayMapView: React.FC<ReplayMapViewProps> = ({
  replayData,
  currentPosition,
  currentTime,
  className = '',
  height = '100vh'
}) => {
  const { theme } = useTheme();

  if (!replayData || replayData.positions.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted/50 ${className}`}
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-4">🗺️</div>
          <p className="text-lg">No replay data available</p>
        </div>
      </div>
    );
  }

  // Calculate map bounds
  const bounds = replayData.positions.reduce((acc: any, pos: any) => {
    return [
      [Math.min(acc[0][0], pos.latitude), Math.min(acc[0][1], pos.longitude)],
      [Math.max(acc[1][0], pos.latitude), Math.max(acc[1][1], pos.longitude)]
    ];
  }, [[90, 180], [-90, -180]]);

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

  const currentIcon = createCustomIcon('#3b82f6', 24);
  const startIcon = createCustomIcon('#10b981', 20);
  const endIcon = createCustomIcon('#ef4444', 20);

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <LeafletMapContainer
        bounds={bounds}
        boundsOptions={{ padding: [20, 20] }}
        className="w-full h-full"
        key={`${theme}-${replayData.positions.length}`}
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

        {/* Current Position Marker */}
        {currentPosition && (
          <Marker
            position={[currentPosition.latitude, currentPosition.longitude]}
            icon={currentIcon}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-medium text-blue-600">Current Position</div>
                <div>Time: {currentTime?.toLocaleString()}</div>
                <div>Speed: {currentPosition.speed?.toFixed(0) || 0} km/h</div>
                {currentPosition.fuelLevel && (
                  <div>Fuel: {currentPosition.fuelLevel.toFixed(1)}%</div>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </LeafletMapContainer>
    </div>
  );
};



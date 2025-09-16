import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';

interface ReplayMarkerProps {
  position: any;
  isPlaying: boolean;
  className?: string;
}

export const ReplayMarker: React.FC<ReplayMarkerProps> = ({
  position,
  isPlaying,
  className = ''
}) => {
  if (!position) return null;

  // Create custom icon based on playing state
  const createCustomIcon = (isPlaying: boolean) => {
    const color = isPlaying ? '#3b82f6' : '#6b7280';
    const size = 24;
    
    return new Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(`
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="12" r="4" fill="white"/>
          ${isPlaying ? `
            <rect x="8" y="6" width="2" height="12" fill="white" rx="1"/>
            <rect x="14" y="6" width="2" height="12" fill="white" rx="1"/>
          ` : `
            <polygon points="9,6 9,18 18,12" fill="white"/>
          `}
        </svg>
      `)}`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  };

  const icon = createCustomIcon(isPlaying);

  return (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={icon}
    >
      <Popup>
        <div className="text-sm">
          <div className="font-medium text-blue-600">
            {isPlaying ? 'Playing' : 'Paused'} Position
          </div>
          <div>Time: {new Date(position.deviceTime).toLocaleString()}</div>
          <div>Speed: {position.speed?.toFixed(0) || 0} km/h</div>
          {position.fuelLevel && (
            <div>Fuel: {position.fuelLevel.toFixed(1)}%</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            Lat: {position.latitude.toFixed(6)}, Lng: {position.longitude.toFixed(6)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
};



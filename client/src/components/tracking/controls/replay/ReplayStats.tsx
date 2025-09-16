import React from 'react';
import { MapPin, Clock, Zap } from 'lucide-react';

interface ReplayStatsProps {
  totalPositions: number;
  totalDistance?: number;
  currentPosition?: {
    latitude?: number;
    longitude?: number;
    speed?: number;
    address?: string;
  };
  isLoading?: boolean;
}

export const ReplayStats: React.FC<ReplayStatsProps> = ({
  totalPositions,
  totalDistance,
  currentPosition,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground text-center">
        Loading replay data...
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Current Position Info */}
      {currentPosition && (
        <div className="bg-muted/50 rounded p-2 space-y-1">
          <div className="flex items-center space-x-1">
            <MapPin className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium">Position</span>
          </div>
          <div className="text-xs space-y-0.5">
            <div className="flex justify-between">
              <span>Lat:</span>
              <span className="font-mono">{currentPosition.latitude?.toFixed(4) || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Lng:</span>
              <span className="font-mono">{currentPosition.longitude?.toFixed(4) || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Speed:</span>
              <span className="font-mono">{currentPosition.speed?.toFixed(1) || '0.0'} km/h</span>
            </div>
            {currentPosition.address && (
              <div className="text-xs text-muted-foreground truncate">
                {currentPosition.address}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="text-xs text-muted-foreground text-center">
        {totalPositions} positions • {totalDistance ? totalDistance.toFixed(1) : '0.0'} km
      </div>
    </div>
  );
};

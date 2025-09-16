import React from 'react';
import { MapPin, Clock, Zap, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiveDataState } from '@/contexts/TrackingModeContext';

interface LiveStatusPanelProps {
  data: LiveDataState;
  className?: string;
}

export const LiveStatusPanel: React.FC<LiveStatusPanelProps> = ({
  data,
  className = ''
}) => {
  const { devices, selectedDevice, isLoading, lastUpdate, error } = data;

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-gray-400';
      case 'unknown': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'unknown': return 'Unknown';
      default: return 'Unknown';
    }
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            Connection Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Live Tracking Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Device Count */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Devices</div>
              <div className="text-2xl font-bold">{devices.length}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Online</div>
              <div className="text-2xl font-bold text-green-600">
                {devices.filter(d => d.status?.toLowerCase() === 'online').length}
              </div>
            </div>
          </div>

          {/* Last Update */}
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Last update:</span>
            <span className="text-sm font-medium">{formatLastUpdate(lastUpdate)}</span>
          </div>

          {/* Loading Status */}
          {isLoading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
              <span className="text-sm text-muted-foreground">Updating...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Device Info */}
      {selectedDevice && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Selected Device
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedDevice.name}</span>
              <Badge 
                variant="secondary" 
                className={`${getStatusColor(selectedDevice.status)} text-white`}
              >
                {getStatusText(selectedDevice.status)}
              </Badge>
            </div>

            {selectedDevice.position && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Speed: </span>
                  <span className="font-medium">
                    {selectedDevice.position.speed?.toFixed(0) || 0} km/h
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Location: </span>
                  <span className="font-mono text-xs">
                    {selectedDevice.position.latitude.toFixed(6)}, {selectedDevice.position.longitude.toFixed(6)}
                  </span>
                </div>
                {selectedDevice.position.fuelLevel && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Fuel: </span>
                    <span className="font-medium">
                      {selectedDevice.position.fuelLevel.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};



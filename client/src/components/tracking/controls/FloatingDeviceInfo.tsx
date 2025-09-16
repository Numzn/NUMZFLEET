import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Signal, X, Navigation, Battery, Wifi, WifiOff, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Device {
  id: number;
  name: string;
  status: string;
  lastUpdate: string;
  uniqueId: string;
  position?: {
    latitude: number;
    longitude: number;
    speed?: number;
    course?: number;
    address?: string;
  };
}

interface FloatingDeviceInfoProps {
  device: Device;
  onClose?: () => void;
  className?: string;
}

export const FloatingDeviceInfo = ({ device, onClose, className = '' }: FloatingDeviceInfoProps) => {
  const formatLastUpdate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const isOnline = device.status.toLowerCase() === 'online';
  const getStatusColor = () => {
    if (isOnline) return 'text-green-500';
    return 'text-red-500';
  };

  const getStatusIcon = () => {
    if (isOnline) return <Wifi className="h-4 w-4" />;
    return <WifiOff className="h-4 w-4" />;
  };

  return (
    <div className={`absolute top-4 left-4 z-[1000] floating-device-info ${className}`}>
      <Card className="w-72 shadow-xl border border-gray-200/50 bg-white/90 backdrop-blur-md hover:bg-white/95 transition-all duration-300">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`p-1.5 rounded-full ${isOnline ? 'bg-green-100' : 'bg-red-100'}`}>
                {getStatusIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-semibold text-gray-900 truncate">
                  {device.name}
                </CardTitle>
                <p className="text-xs text-gray-500 font-mono truncate">{device.uniqueId}</p>
              </div>
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="close-button h-8 w-8 p-0 rounded-full flex-shrink-0 ml-2"
                title="Close device info"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-2 pt-0">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className={`text-xs font-medium ${getStatusColor()}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <Badge 
              variant={isOnline ? 'default' : 'secondary'}
              className="text-xs px-2 py-0.5"
            >
              {isOnline ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          {/* Last Update */}
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500">Last seen:</span>
            <span className="font-medium text-gray-700">{formatLastUpdate(device.lastUpdate)}</span>
          </div>
          
          {/* Position Info */}
          {device.position && (
            <div className="space-y-1.5 pt-1 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs">
                <Navigation className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-gray-500">Location:</span>
                <span className="font-mono text-gray-700">
                  {device.position.latitude.toFixed(4)}, {device.position.longitude.toFixed(4)}
                </span>
              </div>
              
              {device.position.speed !== undefined && (
                <div className="flex items-center gap-2 text-xs">
                  <Activity className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-gray-500">Speed:</span>
                  <span className="font-medium text-gray-700">{device.position.speed} km/h</span>
                </div>
              )}
              
              {device.position.course !== undefined && (
                <div className="flex items-center gap-2 text-xs">
                  <Navigation className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-gray-500">Heading:</span>
                  <span className="font-medium text-gray-700">{device.position.course}°</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

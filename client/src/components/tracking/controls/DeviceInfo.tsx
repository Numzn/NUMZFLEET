import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Battery, Signal } from 'lucide-react';
import { TraccarDevice } from '@shared/schema';

interface DeviceInfoProps {
  device: TraccarDevice;
  className?: string;
}

export const DeviceInfo = ({ device, className = '' }: DeviceInfoProps) => {
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

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          {device.name}
          <Badge 
            variant={device.status === 'online' ? 'default' : 'secondary'}
            className="ml-auto"
          >
            {device.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Last Update:</span>
          <span>{formatLastUpdate(device.lastUpdate)}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Signal className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Device ID:</span>
          <span className="font-mono">{device.uniqueId}</span>
        </div>
        
        {device.phone && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Phone:</span>
            <span>{device.phone}</span>
          </div>
        )}
        
        {device.model && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Model:</span>
            <span>{device.model}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};






import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, MapPin, Wifi, WifiOff } from 'lucide-react';
import { TraccarDevice } from '@shared/schema';

interface DeviceSelectorProps {
  devices: TraccarDevice[];
  selectedDeviceId?: number;
  onDeviceSelect: (deviceId: number | undefined) => void;
  className?: string;
}

export const DeviceSelector = ({
  devices,
  selectedDeviceId,
  onDeviceSelect,
  className = '',
}: DeviceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  console.log('🔍 DeviceSelector: Received devices:', devices.length, 'Selected:', selectedDeviceId);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);
  const onlineCount = devices.filter(d => d.status === 'online').length;

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 min-w-[200px] justify-between"
      >
        <div className="flex items-center gap-2">
          {selectedDevice ? (
            <>
              <MapPin className="h-4 w-4" />
              <span className="truncate">{selectedDevice.name}</span>
              <Badge 
                variant={selectedDevice.status === 'online' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {selectedDevice.status}
              </Badge>
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              <span>All Devices</span>
              <Badge variant="outline" className="text-xs">
                {onlineCount}/{devices.length}
              </Badge>
            </>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-[9999]">
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onDeviceSelect(undefined);
                setIsOpen(false);
              }}
            >
              <MapPin className="h-4 w-4 mr-2" />
              All Devices
              <Badge variant="outline" className="ml-auto text-xs">
                {onlineCount}/{devices.length}
              </Badge>
            </Button>
            
            {devices.map((device) => (
              <Button
                key={device.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  onDeviceSelect(device.id);
                  setIsOpen(false);
                }}
              >
                {device.status === 'online' ? (
                  <Wifi className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 mr-2 text-gray-400" />
                )}
                <span className="truncate">{device.name}</span>
                <Badge 
                  variant={device.status === 'online' ? 'default' : 'secondary'}
                  className="ml-auto text-xs"
                >
                  {device.status}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


import React from 'react';
import { Car } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Device {
  id: number;
  name: string;
  status: string;
}

interface DeviceSelectorProps {
  devices: Device[];
  selectedDeviceId?: number;
  onDeviceSelect: (deviceId: number) => void;
  isLoading?: boolean;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  devices,
  selectedDeviceId,
  onDeviceSelect,
  isLoading = false
}) => {

  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium flex items-center">
        <Car className="w-3 h-3 mr-1" />
        Device
      </label>
      <Select
        value={selectedDeviceId?.toString() || ''}
        onValueChange={(value) => onDeviceSelect(parseInt(value))}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full h-7 text-xs">
          <SelectValue placeholder="Select device" />
        </SelectTrigger>
        <SelectContent>
          {devices.length === 0 ? (
            <SelectItem value="no-devices" disabled>
              <span className="text-xs">No devices</span>
            </SelectItem>
          ) : (
            devices.map((device) => (
              <SelectItem key={device.id} value={device.id.toString()}>
                <div className="flex items-center space-x-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    device.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <span className="text-xs">{device.name}</span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

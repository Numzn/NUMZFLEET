import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, Search, Filter, X } from 'lucide-react';
import { TraccarDevice } from '@shared/schema';

interface DeviceSelectorProps {
  devices: TraccarDevice[];
  selectedDevices: number[];
  onSelectDevices: (deviceIds: number[]) => void;
  isLoading?: boolean;
  maxSelection?: number;
}

export const DeviceSelector = ({
  devices,
  selectedDevices,
  onSelectDevices,
  isLoading = false,
  maxSelection = 10,
}: DeviceSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Filter devices based on search and status
  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.uniqueId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDeviceToggle = (deviceId: number) => {
    const newSelection = selectedDevices.includes(deviceId)
      ? selectedDevices.filter(id => id !== deviceId)
      : selectedDevices.length < maxSelection
        ? [...selectedDevices, deviceId]
        : selectedDevices;
    
    onSelectDevices(newSelection);
  };

  const handleSelectAll = () => {
    const allDeviceIds = filteredDevices.map(device => device.id);
    onSelectDevices(allDeviceIds.slice(0, maxSelection));
  };

  const handleClearSelection = () => {
    onSelectDevices([]);
  };

  const handleSelectOnline = () => {
    const onlineDeviceIds = filteredDevices
      .filter(device => device.status === 'online')
      .map(device => device.id);
    onSelectDevices(onlineDeviceIds.slice(0, maxSelection));
  };

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Device Selection
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {selectedDevices.length} selected
            </Badge>
            {maxSelection && (
              <Badge variant="secondary">
                Max: {maxSelection}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Status:</Label>
            <div className="flex gap-1">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All ({devices.length})
              </Button>
              <Button
                variant={statusFilter === 'online' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('online')}
              >
                Online ({onlineCount})
              </Button>
              <Button
                variant={statusFilter === 'offline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('offline')}
              >
                Offline ({offlineCount})
              </Button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={isLoading || filteredDevices.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectOnline}
            disabled={isLoading || onlineCount === 0}
          >
            Select Online
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearSelection}
            disabled={isLoading || selectedDevices.length === 0}
          >
            Clear
          </Button>
        </div>

        {/* Device List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Available Devices ({filteredDevices.length})</span>
            {selectedDevices.length > 0 && (
              <span className="text-muted-foreground">
                {selectedDevices.length} selected
              </span>
            )}
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading devices...</span>
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No devices found</p>
                {searchTerm && (
                  <p className="text-xs">Try adjusting your search terms</p>
                )}
              </div>
            ) : (
              filteredDevices.map((device) => (
                <div
                  key={device.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    selectedDevices.includes(device.id)
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedDevices.includes(device.id)}
                      onCheckedChange={() => handleDeviceToggle(device.id)}
                      disabled={!selectedDevices.includes(device.id) && selectedDevices.length >= maxSelection}
                    />
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{device.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {device.uniqueId}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                      {device.status}
                    </Badge>
                    {device.lastUpdate && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(device.lastUpdate).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selection Limit Warning */}
        {selectedDevices.length >= maxSelection && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <X className="h-4 w-4" />
              <span className="text-sm font-medium">Selection Limit Reached</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              You can only select up to {maxSelection} devices at a time. 
              Deselect some devices to add more.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


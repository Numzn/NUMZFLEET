import { useState, useEffect } from 'react';
import { TrackingMap } from '@/components/tracking/map/TrackingMap';
import { DeviceSelector } from '@/components/tracking/controls/DeviceSelector';
import { MapControls } from '@/components/tracking/controls/MapControls';
import { DeviceInfo } from '@/components/tracking/controls/DeviceInfo';
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator';
import { useTraccarDevices } from '@/hooks/use-traccar';
import { generateTraccarUrl } from '@/lib/traccar-auth';

export default function LiveTrackingNew() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | undefined>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Data hooks
  const { data: traccarDevices = [], isLoading: traccarLoading } = useTraccarDevices();

  // No need to prevent scrolling since we're working within app layout

  const selectedDevice = traccarDevices.find(d => d.id === selectedDeviceId);

  const handleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleOpenExternal = () => {
    const url = generateTraccarUrl({
      deviceId: selectedDeviceId,
      fullscreen: true,
      hideHeader: true,
      hideMenu: true,
      mapOnly: true
    });
    window.open(url, '_blank');
  };

  if (traccarLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading devices...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top Controls Bar */}
      <div className="flex-shrink-0 p-4 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <DeviceSelector
              devices={traccarDevices}
              selectedDeviceId={selectedDeviceId}
              onDeviceSelect={setSelectedDeviceId}
            />
            
            {selectedDevice && (
              <DeviceInfo 
                device={selectedDevice}
                className="w-80"
              />
            )}
          </div>

          <div className="flex items-center gap-4">
            <NetworkStatusIndicator />
            <MapControls
              selectedDevice={selectedDevice}
              onFullscreen={handleFullscreen}
              onOpenExternal={handleOpenExternal}
              isFullscreen={isFullscreen}
            />
          </div>
        </div>
      </div>

      {/* Map View - Takes remaining space */}
      <div className="flex-1 relative min-h-[500px]">
        <TrackingMap
          height="100%"
        />
      </div>
    </div>
  );
}

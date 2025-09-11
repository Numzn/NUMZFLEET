import { useState, useEffect } from 'react';
import { TrackingMap } from '@/components/tracking/map/TrackingMap';
import { DeviceSelector } from '@/components/tracking/controls/DeviceSelector';
import { MapControls } from '@/components/tracking/controls/MapControls';
import { DeviceInfo } from '@/components/tracking/controls/DeviceInfo';
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator';
import { useDeviceData } from '@/components/tracking/map/useDeviceData';
import { generateTraccarUrl } from '@/lib/traccar-auth';

export default function LiveTrackingNew() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | undefined>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Use the same data source as the map for consistency
  const { devices: traccarDevices = [], isLoading: traccarLoading, error: traccarError } = useDeviceData();

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
            <p className="text-muted-foreground">Loading devices from Traccar...</p>
            <p className="text-xs text-muted-foreground mt-2">Connecting to GPS server...</p>
          </div>
        </div>
      </div>
    );
  }

  if (traccarError) {
    // Safely convert error to string
    const errorMessage = traccarError instanceof Error ? traccarError.message : String(traccarError);
    
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-destructive text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2">Connection Failed</h2>
            <p className="text-muted-foreground mb-4">
              Cannot connect to Traccar GPS server. This could be due to:
            </p>
            <ul className="text-sm text-muted-foreground text-left mb-4">
              <li>• Server is offline or unreachable</li>
              <li>• Authentication credentials are incorrect</li>
              <li>• Network connectivity issues</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Error: {errorMessage}
            </p>
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
            {/* Subtle background update indicator */}
            {traccarLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span>Updating...</span>
              </div>
            )}
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

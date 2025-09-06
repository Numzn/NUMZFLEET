import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Maximize2, 
  Minimize2, 
  Settings, 
  Eye, 
  EyeOff,
  MapPin,
  Users,
  Car
} from 'lucide-react';

interface FloatingControlsProps {
  showControls: boolean;
  setShowControls: (show: boolean) => void;
  isFullscreen: boolean;
  setIsFullscreen: (fullscreen: boolean) => void;
  traccarDevices: any[];
  traccarUrl?: string;
}

export function FloatingControls({
  showControls,
  setShowControls,
  isFullscreen,
  setIsFullscreen,
  traccarDevices,
  traccarUrl
}: FloatingControlsProps) {
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const deviceCount = traccarDevices?.length || 0;
  const onlineDevices = traccarDevices?.filter(device => device.status === 'online')?.length || 0;

  return (
    <>
      {/* Toggle Controls Button */}
      <Button
        onClick={toggleControls}
        variant="secondary"
        size="sm"
        className={`fixed top-20 right-4 z-50 transition-all duration-200 ${
          showControls ? 'opacity-100' : 'opacity-70 hover:opacity-100'
        }`}
      >
        {showControls ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>

      {/* Floating Controls Panel */}
      {showControls && (
        <Card className="fixed top-20 right-4 z-50 w-64 p-4 shadow-lg border bg-background/95 backdrop-blur-sm">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Tracking Controls</h3>
              <Button
                onClick={toggleControls}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>

            {/* Fullscreen Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Display Mode
              </label>
              <Button
                onClick={toggleFullscreen}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Exit Fullscreen
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Enter Fullscreen
                  </>
                )}
              </Button>
            </div>

            {/* Device Status */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Device Status
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <Car className="h-3 w-3 text-muted-foreground" />
                  <span>Total: {deviceCount}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-3 w-3 text-green-500" />
                  <span>Online: {onlineDevices}</span>
                </div>
              </div>
            </div>

            {/* Traccar Connection */}
            {traccarUrl && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Traccar Server
                </label>
                <div className="text-xs text-muted-foreground break-all">
                  {traccarUrl}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Quick Actions
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => window.open(traccarUrl, '_blank')}
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Traccar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => window.location.reload()}
                >
                  <Users className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}


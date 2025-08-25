import { useState, useEffect } from 'react';
import { NavigationBar } from '@/components/NavigationBar';
import { TraccarIframe } from '@/components/tracking/TraccarIframe';
import { useTraccarDevices } from '@/hooks/use-traccar';
import { Settings, Maximize2, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateTraccarUrl } from '@/lib/traccar-auth';

export default function LiveTracking() {
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Data hooks
  const { data: traccarDevices = [], isLoading: traccarLoading } = useTraccarDevices();

  // Prevent scrolling when component mounts
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const openInNewTab = () => {
    const cleanUrl = generateTraccarUrl({
      fullscreen: true,
      hideHeader: true,
      hideMenu: true,
      autoLogin: true
    });
    window.open(cleanUrl, '_blank');
  };

  if (traccarLoading) {
    return (
      <div className="h-screen bg-background overflow-hidden">
        <NavigationBar />
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading Traccar interface...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background overflow-hidden">
      <NavigationBar />
      
      {/* Single Settings Button */}
      <div className="fixed top-20 right-4 z-50">
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => setShowControls(!showControls)}
          className="h-10 w-10 p-0 rounded-full shadow-lg backdrop-blur-sm"
        >
          <Settings className="h-4 w-4" />
        </Button>
            </div>
            
      {/* Floating Status Panel */}
      {showControls && (
        <div className="fixed top-20 left-4 z-50">
          <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg max-w-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Traccar Status</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowControls(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Connected</span>
              </div>
              <div>
                <span className="text-muted-foreground">Devices:</span>
                <span className="ml-1 font-medium">{traccarDevices.length}</span>
              </div>
              <div className="text-muted-foreground font-mono text-xs">
                {import.meta.env.VITE_TRACCAR_URL || 'http://localhost:8082'}
        </div>
        </div>

            {/* Control Buttons */}
            <div className="space-y-2 mt-3 pt-3 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2">Controls</div>
              <div className="flex space-x-2">
                      <Button
                  variant="outline" 
                        size="sm"
                  onClick={handleFullscreen}
                  className="flex-1 text-xs"
                >
                  <Maximize2 className="h-3 w-3 mr-1" />
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                      </Button>
                    <Button
                  variant="outline" 
                      size="sm"
                  onClick={openInNewTab}
                  className="flex-1 text-xs"
                    >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                    </Button>
                          </div>
                        </div>
                        </div>
                      </div>
      )}

      {/* Full Screen Traccar Interface */}
      <div className={isFullscreen ? "fixed inset-0 z-40" : "absolute inset-0 top-16"}>
            <TraccarIframe
          deviceId={undefined}
          height="100%"
          showControls={false}
          autoRefresh={false}
              refreshInterval={30000}
            />
                </div>
    </div>
  );
} 
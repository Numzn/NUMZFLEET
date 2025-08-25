import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { generateTraccarUrl } from '@/lib/traccar-auth';
import { useTraccarAuth } from '@/hooks/use-traccar-auth';

interface TraccarIframeProps {
  deviceId?: string | number;
  className?: string;
  height?: string;
  showControls?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const TraccarIframe = ({
  deviceId,
  className = '',
  height = '600px',
  showControls = true,
  autoRefresh = false,
  refreshInterval = 30000, // 30 seconds
}: TraccarIframeProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, isAuthenticating, authenticate } = useTraccarAuth();

  const baseUrl = import.meta.env.VITE_TRACCAR_URL || 'http://localhost:8082';

  const updateIframeUrl = async () => {
    if (!iframeRef.current) return;
    
    // Ensure authentication before loading iframe
    if (!isAuthenticated && !isAuthenticating) {
      console.log('🔐 Authenticating with Traccar before loading iframe...');
      const authSuccess = await authenticate();
      if (!authSuccess) {
        console.warn('⚠️ Traccar authentication failed, proceeding anyway...');
      }
      
      // Add a small delay to ensure authentication cookies are set
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Generate URL with authentication parameters
    const url = generateTraccarUrl({
      deviceId,
      fullscreen: true,
      hideHeader: true,
      hideMenu: true,
      autoLogin: true
    });
    
    console.log('🔄 Loading Traccar iframe with URL:', url);
    iframeRef.current.src = url;
    setIsLoading(true);
    setError(null);
  };

  const handleRefresh = async () => {
    await updateIframeUrl();
    setLastRefresh(new Date());
  };

  const handleFullscreen = () => {
    if (!iframeRef.current) return;
    
    if (!isFullscreen) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const openInNewTab = () => {
    const url = generateTraccarUrl({
      deviceId,
      fullscreen: true,
      hideHeader: true,
      hideMenu: true,
      autoLogin: true
    });
    
    window.open(url, '_blank');
  };

  // Handle iframe load events
  const handleLoad = () => {
    console.log('✅ Traccar iframe loaded successfully');
    setIsLoading(false);
    setError(null);
  };

  const handleError = () => {
    console.error('❌ Traccar iframe failed to load');
    setIsLoading(false);
    setError('Failed to load Traccar interface');
  };

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      handleRefresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Update URL when props change
  useEffect(() => {
    updateIframeUrl();
  }, [deviceId, baseUrl]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <>
      {showControls ? (
        <Card className={`w-full ${className}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <span>Traccar GPS Tracking</span>
                {deviceId && (
                  <Badge variant="outline">Device {deviceId}</Badge>
                )}
                {autoRefresh && (
                  <Badge variant="secondary" className="text-xs">
                    Auto-refresh
                  </Badge>
                )}
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4 mr-1" />
                  ) : (
                    <Maximize2 className="h-4 w-4 mr-1" />
                  )}
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInNewTab}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
              </div>
            </div>
            
            {lastRefresh && (
              <p className="text-xs text-muted-foreground">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </p>
            )}
          </CardHeader>
          
          <CardContent className="p-0">
            <div 
              className="relative w-full bg-muted rounded-b-lg overflow-hidden"
              style={{ height }}
            >
              {(isLoading || isAuthenticating) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>
                      {isAuthenticating ? 'Authenticating with Traccar...' : 'Loading Traccar interface...'}
                    </span>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <div className="text-center">
                    <p className="text-destructive mb-2">{error}</p>
                    <Button variant="outline" size="sm" onClick={handleRefresh}>
                      Retry
                    </Button>
                  </div>
                </div>
              )}
              
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0"
                title="Traccar GPS Tracking Interface"
                allow="geolocation *; fullscreen"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                onLoad={handleLoad}
                onError={handleError}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        // Clean iframe-only version
        <div 
          className={`relative w-full h-full bg-background ${className}`}
          style={{ height }}
        >
          {(isLoading || isAuthenticating) && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10 backdrop-blur-sm">
              <div className="flex items-center gap-2 bg-background/95 p-4 rounded-lg shadow-lg">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>
                  {isAuthenticating ? 'Authenticating with Traccar...' : 'Loading Traccar interface...'}
                </span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10 backdrop-blur-sm">
              <div className="text-center bg-background/95 p-4 rounded-lg shadow-lg">
                <p className="text-destructive mb-2">{error}</p>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  Retry
                </Button>
              </div>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            title="Traccar GPS Tracking Interface"
            allow="geolocation *; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      )}
    </>
  );
};


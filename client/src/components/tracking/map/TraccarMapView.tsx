import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { generateTraccarUrl } from '@/lib/traccar-auth';
import { useTraccarBackgroundAuth } from '@/lib/traccar-auth';

interface TraccarMapViewProps {
  deviceId?: string | number;
  className?: string;
  height?: string;
}

export const TraccarMapView = ({
  deviceId,
  className = '',
  height = '100%',
}: TraccarMapViewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, isAuthenticating, authenticate } = useTraccarBackgroundAuth();

  const updateIframeUrl = async () => {
    if (!iframeRef.current) return;
    
    // Ensure authentication before loading iframe
    if (!isAuthenticated && !isAuthenticating) {
      console.log('🔐 Authenticating with Traccar...');
      const authSuccess = await authenticate();
      if (!authSuccess) {
        console.warn('⚠️ Traccar authentication failed, proceeding anyway...');
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Generate clean map-only URL with authentication
    const url = generateTraccarUrl({
      deviceId,
      fullscreen: true,
      hideHeader: true,
      hideMenu: true,
      hideControls: true,
      mapOnly: true,
      autoLogin: true
    });
    
    console.log('🗺️ Loading Traccar map view:', url);
    iframeRef.current.src = url;
    setIsLoading(true);
    setError(null);
  };

  const handleLoad = () => {
    console.log('✅ Traccar map loaded successfully');
    setIsLoading(false);
    setError(null);
  };

  const handleError = () => {
    console.error('❌ Traccar map failed to load');
    setIsLoading(false);
    setError('Failed to load map view');
  };

  const handleRetry = () => {
    updateIframeUrl();
  };

  useEffect(() => {
    updateIframeUrl();
  }, [deviceId]);

  return (
    <div 
      className={`relative w-full bg-background ${className}`}
      // eslint-disable-next-line react/forbid-dom-props
      style={{ height }}
    >
      {(isLoading || isAuthenticating) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-2 bg-background/95 p-4 rounded-lg shadow-lg">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>
              {isAuthenticating ? 'Authenticating...' : 'Loading map...'}
            </span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10 backdrop-blur-sm">
          <div className="text-center bg-background/95 p-4 rounded-lg shadow-lg">
            <p className="text-destructive mb-2">{error}</p>
            <button 
              onClick={handleRetry}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        title="Traccar Map View"
        allow="geolocation *; fullscreen"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};

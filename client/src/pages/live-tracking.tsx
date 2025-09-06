import { useState, useEffect } from 'react';

import { TraccarIframe } from '@/components/tracking/TraccarIframe';
import { FloatingControls } from '@/components/tracking/FloatingControls';
import { useTraccarDevices } from '@/hooks/use-traccar';

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

  if (traccarLoading) {
    return (
      <div className="h-screen bg-background overflow-hidden">
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
      {/* Floating Controls */}
      <FloatingControls
        showControls={showControls}
        setShowControls={setShowControls}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
        traccarDevices={traccarDevices}
        traccarUrl={import.meta.env.VITE_TRACCAR_URL}
      />

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
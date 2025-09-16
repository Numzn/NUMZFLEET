import React, { useEffect } from "react";
import { useMap } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { 
  Navigation, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Target
} from "lucide-react";
import { Device } from "./types";

interface SimpleMapControlsProps {
  devices: Device[];
  selectedDevice?: Device;
  onDeviceSelect?: (device: Device) => void;
  onMapReady?: (map: any) => void;
}

export const SimpleMapControls = ({ 
  devices, 
  selectedDevice, 
  onDeviceSelect,
  onMapReady
}: SimpleMapControlsProps) => {
  const map = useMap();
  
  // Notify parent component when map is ready
  useEffect(() => {
    if (map && onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  

  // Handle map resize when component mounts or updates
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    // Resize on mount
    handleResize();

    // Listen for window resize events
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  const centerMap = () => {
    if (devices.length === 0) {
      map.setView([-15.35, 28.28], 13);
      return;
    }

    const positions = devices
      .filter(device => device.position?.latitude && device.position?.longitude)
      .map(device => [device.position!.latitude, device.position!.longitude] as [number, number]);

    if (positions.length === 0) {
      map.setView([-15.35, 28.28], 13);
      return;
    }

    if (positions.length === 1) {
      map.setView(positions[0], 15);
    } else {
      const bounds = positions.map(pos => [pos[0], pos[1]] as [number, number]);
      // Use larger padding to ensure proper centering and account for sidebar
      map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 16
      });
    }
    
    // Force a resize to ensure proper layout
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  };

  const centerOnSelectedDevice = () => {
    if (selectedDevice?.position?.latitude && selectedDevice?.position?.longitude) {
      map.setView(
        [selectedDevice.position.latitude, selectedDevice.position.longitude], 
        15
      );
      // Force a resize to ensure proper layout
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  };

  const zoomIn = () => {
    map.zoomIn();
  };

  const zoomOut = () => {
    map.zoomOut();
  };

  const resetView = () => {
    map.setView([-15.35, 28.28], 13);
  };

  return (
    <div 
      className="leaflet-control leaflet-bar"
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 'calc(100vw - 20px)',
        maxHeight: 'calc(100vh - 20px)'
      }}
    >
      {/* Clean Control Panel */}
      <div 
        style={{
          background: 'transparent',
          borderRadius: '6px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}
      >
        {/* Center Map Button */}
        <button
          onClick={centerMap}
          title="Center map on all devices"
          className="map-control-btn"
          style={{
            width: '32px',
            height: '32px',
            background: 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#374151',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
        >
          <Navigation className="h-4 w-4" />
        </button>

        {/* Center on Selected Device */}
        {selectedDevice && (
          <button
            onClick={centerOnSelectedDevice}
            title={`Center on ${selectedDevice.name}`}
            className="map-control-btn"
            style={{
              width: '32px',
              height: '32px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
          >
            <Target className="h-4 w-4" />
          </button>
        )}

        {/* Zoom Controls Container */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '2px'
        }}>
          <button
            onClick={zoomIn}
            title="Zoom in"
            className="map-control-btn"
            style={{
              width: '32px',
              height: '32px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontSize: '16px',
              fontWeight: '500',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
          >
            +
          </button>
          <button
            onClick={zoomOut}
            title="Zoom out"
            className="map-control-btn"
            style={{
              width: '32px',
              height: '32px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontSize: '16px',
              fontWeight: '500',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
          >
            −
          </button>
        </div>

        {/* Reset View Button */}
        <button
          onClick={resetView}
          title="Reset to default view"
          style={{
            width: '32px',
            height: '32px',
            background: 'transparent',
            border: 'none',
            borderRadius: '4px',
            color: '#374151',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
};

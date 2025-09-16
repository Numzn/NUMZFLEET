import React from "react";
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

interface MapControlsProps {
  devices: Device[];
  selectedDevice?: Device;
  onDeviceSelect?: (device: Device) => void;
}

export const MapControls = ({ 
  devices, 
  selectedDevice, 
  onDeviceSelect 
}: MapControlsProps) => {
  const map = useMap();
  
  // Debug logging
  console.log('🗺️ MapControls: Rendering with', { 
    devicesCount: devices.length, 
    selectedDevice: selectedDevice?.name 
  });

  const centerMap = () => {
    if (devices.length === 0) {
      // Default center to Harare, Zimbabwe
      map.setView([-17.8252, 31.0335], 12);
      return;
    }

    // Calculate bounds to fit all devices
    const positions = devices
      .filter(device => device.position?.latitude && device.position?.longitude)
      .map(device => [device.position!.latitude, device.position!.longitude] as [number, number]);

    if (positions.length === 0) {
      // Fallback to default center
      map.setView([-17.8252, 31.0335], 12);
      return;
    }

    if (positions.length === 1) {
      // Center on single device
      map.setView(positions[0], 15);
    } else {
      // Fit bounds to show all devices
      const bounds = positions.map(pos => [pos[0], pos[1]] as [number, number]);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  };

  const centerOnSelectedDevice = () => {
    if (selectedDevice?.position?.latitude && selectedDevice?.position?.longitude) {
      map.setView(
        [selectedDevice.position.latitude, selectedDevice.position.longitude], 
        15
      );
    }
  };

  const zoomIn = () => {
    map.zoomIn();
  };

  const zoomOut = () => {
    map.zoomOut();
  };

  const resetView = () => {
    map.setView([-17.8252, 31.0335], 12);
  };

  return (
    <div 
      className="absolute top-2 right-2 z-50"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
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
          gap: '2px',
          minWidth: '44px'
        }}
      >
        {/* Center Map Button */}
        <button
          onClick={centerMap}
          title="Center map on all devices"
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
          <Navigation className="h-4 w-4" />
        </button>

        {/* Center on Selected Device */}
        {selectedDevice && (
          <button
            onClick={centerOnSelectedDevice}
            title={`Center on ${selectedDevice.name}`}
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
            style={{
              width: '28px',
              height: '28px',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            +
          </button>
          <button
            onClick={zoomOut}
            title="Zoom out"
            style={{
              width: '28px',
              height: '28px',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
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


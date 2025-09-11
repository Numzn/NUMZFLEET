import React from "react";
import { useMap } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { 
  Navigation, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Target,
  MapPin
} from "lucide-react";
import { Device } from "./types";

interface SimpleMapControlsProps {
  devices: Device[];
  selectedDevice?: Device;
  onDeviceSelect?: (device: Device) => void;
}

export const SimpleMapControls = ({ 
  devices, 
  selectedDevice, 
  onDeviceSelect 
}: SimpleMapControlsProps) => {
  const map = useMap();
  
  // Debug logging
  console.log('🗺️ SimpleMapControls: Rendering with', { 
    devicesCount: devices.length, 
    selectedDevice: selectedDevice?.name 
  });

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
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Clean Control Panel */}
      <div 
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '6px',
          padding: '4px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}
      >
        {/* Center Map Button */}
        <button
          onClick={centerMap}
          title="Center map on all devices"
          style={{
            width: '32px',
            height: '32px',
            background: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            color: '#374151',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f9fafb';
            e.currentTarget.style.borderColor = '#9ca3af';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.borderColor = '#d1d5db';
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
              background: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            <Target className="h-4 w-4" />
          </button>
        )}

        {/* Zoom Controls Container */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '6px',
          background: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '8px',
          padding: '6px'
        }}>
          <button
            onClick={zoomIn}
            title="Zoom in"
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 8px rgba(79, 172, 254, 0.3)',
              fontSize: '18px',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 172, 254, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(79, 172, 254, 0.3)';
            }}
          >
            +
          </button>
          <button
            onClick={zoomOut}
            title="Zoom out"
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 8px rgba(250, 112, 154, 0.3)',
              fontSize: '18px',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(250, 112, 154, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(250, 112, 154, 0.3)';
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
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            border: 'none',
            borderRadius: '10px',
            color: '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 12px rgba(168, 237, 234, 0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(168, 237, 234, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 237, 234, 0.4)';
          }}
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>

      {/* Professional Device List */}
      {devices.length > 0 && (
        <div 
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxHeight: '240px',
            overflowY: 'auto',
            minWidth: '220px',
            marginTop: '8px'
          }}
        >
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '12px',
            padding: '0 4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            📱 Devices ({devices.length})
          </div>
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() => onDeviceSelect?.(device)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: selectedDevice?.id === device.id 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'transparent',
                color: selectedDevice?.id === device.id ? 'white' : '#374151',
                marginBottom: '4px',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (selectedDevice?.id !== device.id) {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedDevice?.id !== device.id) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.transform = 'translateX(0)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: device.status === 'online' 
                    ? '#10b981'
                    : device.status === 'offline'
                    ? '#ef4444'
                    : '#f59e0b',
                  boxShadow: device.status === 'online' 
                    ? '0 0 8px rgba(16, 185, 129, 0.6)'
                    : 'none'
                }} />
                <MapPin className="h-4 w-4" style={{ 
                  color: selectedDevice?.id === device.id ? 'white' : '#6b7280' 
                }} />
                <span style={{ 
                  flex: 1, 
                  fontWeight: selectedDevice?.id === device.id ? '600' : '500',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {device.name}
                </span>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: selectedDevice?.id === device.id 
                    ? 'rgba(255, 255, 255, 0.2)'
                    : device.status === 'online' 
                    ? 'rgba(16, 185, 129, 0.1)'
                    : device.status === 'offline'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(245, 158, 11, 0.1)',
                  color: selectedDevice?.id === device.id 
                    ? 'white'
                    : device.status === 'online' 
                    ? '#10b981'
                    : device.status === 'offline'
                    ? '#ef4444'
                    : '#f59e0b'
                }}>
                  {device.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

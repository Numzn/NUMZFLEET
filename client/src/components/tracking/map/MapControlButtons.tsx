import React from "react";
import { createPortal } from "react-dom";
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

interface MapControlButtonsProps {
  devices: Device[];
  selectedDevice?: Device;
  onDeviceSelect?: (device: Device) => void;
}

export const MapControlButtons = ({ 
  devices, 
  selectedDevice, 
  onDeviceSelect 
}: MapControlButtonsProps) => {
  const map = useMap();
  
  // Debug logging
  console.log('🗺️ MapControlButtons: Rendering with', { 
    devicesCount: devices.length, 
    selectedDevice: selectedDevice?.name 
  });

  const centerMap = () => {
    if (devices.length === 0) {
      // Default center to Lusaka, Zambia
      map.setView([-15.35, 28.28], 13);
      return;
    }

    // Calculate bounds to fit all devices
    const positions = devices
      .filter(device => device.position?.latitude && device.position?.longitude)
      .map(device => [device.position!.latitude, device.position!.longitude] as [number, number]);

    if (positions.length === 0) {
      // Fallback to default center
      map.setView([-15.35, 28.28], 13);
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
    map.setView([-15.35, 28.28], 13);
  };

  // Use a ref to ensure we only create the container once
  const controlRef = React.useRef<HTMLDivElement | null>(null);
  
  React.useEffect(() => {
    if (!controlRef.current) {
      const controlContainer = document.createElement('div');
      controlContainer.className = 'custom-map-controls';
      controlContainer.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        background: transparent;
        border: none;
        box-shadow: none;
      `;
      
      const mapContainer = map.getContainer();
      mapContainer.appendChild(controlContainer);
      controlRef.current = controlContainer;
    }
  }, [map]);

  if (!controlRef.current) {
    return null;
  }

  return createPortal(
    <div className="flex flex-col gap-2">
      {/* Center Map Button */}
      <Button
        onClick={centerMap}
        size="sm"
        variant="outline"
        className="bg-white/95 hover:bg-white shadow-lg border-0"
        title="Center map on all devices"
      >
        <Navigation className="h-4 w-4" />
      </Button>

      {/* Center on Selected Device */}
      {selectedDevice && (
        <Button
          onClick={centerOnSelectedDevice}
          size="sm"
          variant="outline"
          className="bg-white/95 hover:bg-white shadow-lg border-0"
          title={`Center on ${selectedDevice.name}`}
        >
          <Target className="h-4 w-4" />
        </Button>
      )}

      {/* Zoom Controls */}
      <div className="flex flex-col gap-1">
        <Button
          onClick={zoomIn}
          size="sm"
          variant="outline"
          className="bg-white/95 hover:bg-white shadow-lg border-0 h-8 w-8 p-0"
          title="Zoom in"
        >
          <ZoomIn className="h-3 w-3" />
        </Button>
        <Button
          onClick={zoomOut}
          size="sm"
          variant="outline"
          className="bg-white/95 hover:bg-white shadow-lg border-0 h-8 w-8 p-0"
          title="Zoom out"
        >
          <ZoomOut className="h-3 w-3" />
        </Button>
      </div>

      {/* Reset View */}
      <Button
        onClick={resetView}
        size="sm"
        variant="outline"
        className="bg-white/95 hover:bg-white shadow-lg border-0"
        title="Reset to default view"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>

      {/* Device List Toggle */}
      {devices.length > 0 && (
        <div className="bg-white/95 rounded-lg shadow-lg p-2 max-h-48 overflow-y-auto">
          <div className="text-xs font-medium text-gray-600 mb-2 px-2">
            Devices ({devices.length})
          </div>
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() => onDeviceSelect?.(device)}
              className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-gray-100 transition-colors ${
                selectedDevice?.id === device.id 
                  ? 'bg-blue-100 text-blue-700 font-medium' 
                  : 'text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{device.name}</span>
                <span className={`text-xs px-1 py-0.5 rounded ${
                  device.status === 'online' 
                    ? 'bg-green-100 text-green-700' 
                    : device.status === 'offline'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {device.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>,
    controlContainer
  );
};

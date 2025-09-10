import React, { useEffect, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import { Device } from "./types";
import { createVehicleIcon, vehicleIcon } from "./MapIcon";

interface DeviceMarkersProps {
  devices: Device[];
}

export const DeviceMarkers = ({ devices }: DeviceMarkersProps) => {
  const markerRefs = useRef<{ [key: number]: any }>({});

  // Update marker positions smoothly when data changes
  useEffect(() => {
    devices.forEach((device) => {
      if (device.position?.latitude && device.position?.longitude) {
        const marker = markerRefs.current[device.id];
        if (marker) {
          // Smooth animation to new position
          marker.setLatLng([device.position.latitude, device.position.longitude], {
            animate: true,
            duration: 1.5
          });
        }
      }
    });
  }, [devices]);

  return (
    <>
      {devices.map((device) => {
        if (!device.position?.latitude || !device.position?.longitude) {
          return null; // Skip devices without position data
        }
        
        const isOnline = device.status === 'online';
        const dynamicIcon = createVehicleIcon(device.status, isOnline, device.name);
        
        return (
          <Marker 
            key={device.id} 
            position={[device.position.latitude, device.position.longitude]} 
            icon={dynamicIcon}
            ref={(ref) => {
              if (ref) {
                markerRefs.current[device.id] = ref;
              }
            }}
            eventHandlers={{
              click: () => {
                // Device clicked - could add functionality here
              }
            }}
          >
            <Popup 
              closeButton={true}
              autoClose={false}
              closeOnClick={false}
              className="custom-popup"
            >
              <div className="p-4 min-w-[280px] max-w-[320px]">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-200">
                  <div className={`w-4 h-4 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} ${isOnline ? 'animate-pulse' : ''}`}></div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{device.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{device.uniqueId}</p>
                  </div>
                </div>
                
                 {/* Status Badge */}
                 <div className="mb-3">
                   <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                     isOnline 
                       ? 'bg-green-100 text-green-800 border border-green-200' 
                       : 'bg-red-100 text-red-800 border border-red-200'
                   }`}>
                     <div className={`w-3 h-3 rounded-full mr-2 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                     {isOnline ? 'ONLINE' : 'OFFLINE'}
                   </span>
                 </div>
                
                {/* Details Grid */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Last Update:</span>
                    <span className="text-gray-800 font-mono text-xs">
                      {new Date(device.lastUpdate).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Coordinates:</span>
                    <span className="text-gray-800 font-mono text-xs text-right">
                      {device.position.latitude.toFixed(6)}<br/>
                      {device.position.longitude.toFixed(6)}
                    </span>
                  </div>
                  
                  {device.position.speed !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Speed:</span>
                      <span className="text-gray-800 font-mono text-xs">
                        {device.position.speed} km/h
                      </span>
                    </div>
                  )}
                  
                  {device.position.course !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Direction:</span>
                      <span className="text-gray-800 font-mono text-xs">
                        {device.position.course}°
                      </span>
                    </div>
                  )}
                  
                  {device.position.address && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <span className="text-gray-600 font-medium text-xs">Address:</span>
                      <p className="text-gray-800 text-xs mt-1 leading-relaxed">
                        {device.position.address}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="mt-3 pt-2 border-t border-gray-200 flex gap-2">
                  <button 
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1.5 px-2 rounded transition-colors"
                    onClick={() => {
                      // Copy coordinates to clipboard
                      navigator.clipboard.writeText(`${device.position.latitude}, ${device.position.longitude}`);
                    }}
                  >
                    Copy Coords
                  </button>
                  <button 
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-xs py-1.5 px-2 rounded transition-colors"
                    onClick={() => {
                      // Center map on this device
                      // This would need to be implemented with map reference
                    }}
                  >
                    Center Map
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

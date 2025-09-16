import React, { useEffect, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import { Device } from "./types";
import { createVehicleIcon, vehicleIcon } from "./MapIcon";

interface DeviceMarkersProps {
  devices: Device[];
  selectedDevice?: Device;
  onDeviceSelect?: (device: Device) => void;
}

export const DeviceMarkers = ({ devices, selectedDevice, onDeviceSelect }: DeviceMarkersProps) => {
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

        // Special debugging for GIFT device
        if (device.name === 'GIFT' || device.id === 20863396) {
          const expectedLat = -15.386024386774672;
          const expectedLng = 28.3081738740988;
          const latDiff = Math.abs(device.position.latitude - expectedLat);
          const lngDiff = Math.abs(device.position.longitude - expectedLng);
          const isAccurate = latDiff < 0.001 && lngDiff < 0.001; // Within 0.001 degrees (about 100m)
          
          console.log('🎯 GIFT DEVICE MARKER CREATION:', {
            deviceName: device.name,
            deviceId: device.id,
            position: device.position,
            coordinates: [device.position.latitude, device.position.longitude],
            expectedCoords: [expectedLat, expectedLng],
            coordinateMatch: isAccurate,
            latDifference: latDiff,
            lngDifference: lngDiff,
            accuracy: isAccurate ? '✅ ACCURATE' : '❌ INACCURATE'
          });
        }

        // Special debugging for NUMZ device
        if (device.name === 'NUMZ' || device.name?.includes('NUMZ')) {
          const accuracy = device.position.accuracy;
          const accuracyScore = device.position.accuracyScore;
          const locationType = accuracy ? `Estimated area (±${accuracy}m)` : 'Exact point';
          
          console.log('🎯 NUMZ DEVICE MARKER CREATION:', {
            deviceName: device.name,
            deviceId: device.id,
            position: device.position,
            coordinates: [device.position.latitude, device.position.longitude],
            accuracy: accuracy,
            accuracyScore: accuracyScore,
            locationType: locationType,
            speed: device.position.speed,
            course: device.position.course,
            address: device.position.address,
            lastUpdate: device.position.lastUpdate
          });
        }

        const isOnline = device.status === 'online';
        const dynamicIcon = createVehicleIcon(
          device.status,
          isOnline,
          device.name,
          device.position?.accuracy,
          device.position?.accuracyScore
        );
        
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
                onDeviceSelect?.(device);
              }
            }}
          >
            <Popup 
              closeButton={true}
              autoClose={false}
              closeOnClick={false}
              className="custom-popup"
              maxWidth={320}
              minWidth={280}
              maxHeight={400}
              keepInView={true}
              offset={[0, -20]}
              position="top"
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
                  
                  {device.position.accuracy && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Accuracy:</span>
                      <span className="text-gray-800 font-mono text-xs">
                        ±{device.position.accuracy}m
                      </span>
                    </div>
                  )}
                  
                  {device.position.accuracyScore && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Quality:</span>
                      <span className={`text-xs font-medium ${
                        device.position.accuracyScore >= 80 ? 'text-green-600' :
                        device.position.accuracyScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {device.position.accuracyScore >= 80 ? 'High' :
                         device.position.accuracyScore >= 60 ? 'Medium' : 'Low'} ({device.position.accuracyScore}%)
                      </span>
                    </div>
                  )}
                  
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

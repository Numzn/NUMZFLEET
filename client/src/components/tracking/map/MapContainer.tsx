import React from "react";
import { MapContainer as LeafletMapContainer, TileLayer } from "react-leaflet";
import "./MapStyles.css";

interface MapContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const MapContainer = ({ children, className = "z-0" }: MapContainerProps) => {

  return (
    <div 
      className="w-full h-full relative map-container-wrapper"
      // eslint-disable-next-line react/forbid-dom-props
      style={{ 
        height: "100%", 
        width: "100%", 
        minHeight: "400px"
      }}
    >
      <LeafletMapContainer 
        center={[-15.35, 28.28]} // Lusaka, Zambia - center of real device locations
        zoom={13} 
        style={{ 
          height: "100%", 
          width: "100%",
          minHeight: "400px"
        }}
        className={`w-full h-full ${className}`}
        whenReady={() => {
          console.log('🗺️ Map ready - Center:', [-15.35, 28.28], 'Zoom: 13');
          console.log('🗺️ Map projection: EPSG:3857 (Web Mercator) - Standard for web maps');
          console.log('🗺️ Expected coordinate format: [latitude, longitude]');
          
          // Test coordinate accuracy with known location
          const testCoords = [-15.386024386774672, 28.3081738740988]; // GIFT device location
          console.log('🎯 Test coordinates for GIFT device:', {
            latLng: testCoords,
            format: '[latitude, longitude]',
            location: 'Lusaka, Zambia'
          });
        }}
      >
        {/* 🔥 Reliable Tile Provider - OpenStreetMap */}
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {children}
      </LeafletMapContainer>
    </div>
  );
};

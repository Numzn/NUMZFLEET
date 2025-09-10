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
      style={{ 
        height: "100%", 
        width: "100%", 
        minHeight: "500px"
      }}
    >
      <LeafletMapContainer 
        center={[-15.4167, 28.2833]} // Default: Lusaka, Zambia
        zoom={12} 
        style={{ 
          height: "100%", 
          width: "100%",
          minHeight: "500px"
        }}
        className={className}
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

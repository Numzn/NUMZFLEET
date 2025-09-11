import React from "react";
import { TrackingMap } from "./TrackingMap";

/**
 * Standalone Map Component
 * This component can be used independently to test the map functionality
 * It includes its own data fetching and error handling
 */
export const StandaloneMap = () => {
  return (
    <div className="w-full h-screen bg-gray-100">
      <div className="h-16 bg-white shadow-sm border-b flex items-center px-4">
        <h1 className="text-xl font-bold text-gray-800">Live Tracking Map</h1>
        <div className="ml-auto text-sm text-gray-500">
          Real-time GPS device tracking
        </div>
      </div>
      
      <div className="h-[calc(100vh-4rem)]">
        <TrackingMap 
          height="100%"
          className="border-0"
        />
      </div>
    </div>
  );
};

export default StandaloneMap;

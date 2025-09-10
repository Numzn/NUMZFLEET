import React from "react";
import { Loader2 } from "lucide-react";

interface MapStatusProps {
  isLoading: boolean;
  deviceCount: number;
  error: string | null;
  onRetry: () => void;
}

export const MapStatus = ({ isLoading, deviceCount, error, onRetry }: MapStatusProps) => {
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10 backdrop-blur-sm">
        <div className="text-center bg-background/95 p-4 rounded-lg shadow-lg">
          <p className="text-destructive mb-2">{error}</p>
          <button 
            onClick={onRetry}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Loading indicator for data - HIDDEN */}
      {isLoading && (
        <div className="absolute top-4 right-4 z-10 opacity-0 pointer-events-none">
          <div className="flex items-center gap-2 bg-background/95 p-3 rounded-lg shadow-lg backdrop-blur-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading devices...</span>
          </div>
        </div>
      )}
      
      {/* Data status indicator - HIDDEN */}
      {!isLoading && deviceCount === 0 && (
        <div className="absolute top-4 right-4 z-10 opacity-0 pointer-events-none">
          <div className="bg-background/95 p-3 rounded-lg shadow-lg backdrop-blur-sm">
            <span className="text-sm text-muted-foreground">No devices found</span>
          </div>
        </div>
      )}
    </>
  );
};

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
    // Safely convert error to string
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10 backdrop-blur-sm">
        <div className="text-center bg-background/95 p-4 rounded-lg shadow-lg">
          <p className="text-destructive mb-2">{errorMessage}</p>
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
      {/* Subtle loading indicator - visible but not intrusive */}
      {isLoading && (
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-2 bg-background/95 p-2 rounded-lg shadow-lg backdrop-blur-sm border border-border/50">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Updating...</span>
          </div>
        </div>
      )}
      
      {/* Data status indicator - only show if no devices and not loading */}
      {!isLoading && deviceCount === 0 && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-background/95 p-2 rounded-lg shadow-lg backdrop-blur-sm border border-border/50">
            <span className="text-xs text-muted-foreground">No devices found</span>
          </div>
        </div>
      )}
    </>
  );
};

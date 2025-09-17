import React from 'react';
import { TrackingMode } from '@/contexts/TrackingModeContext';

interface DebugPanelProps {
  mode: TrackingMode;
  selectedDeviceId: number | null;
  positionsCount: number;
  isLoading: boolean;
  error: string | Error | null;
  showControls: boolean;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  mode,
  selectedDeviceId,
  positionsCount,
  isLoading,
  error,
  showControls
}) => {
  return (
    <div className="fixed top-2 right-2 bg-black/80 text-white p-1 rounded text-xs z-50">
      <div>Mode: {mode}</div>
      <div>Device: {selectedDeviceId || 'None'}</div>
      <div>Positions: {positionsCount}</div>
      <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
      <div>Error: {error?.message || error || 'None'}</div>
      <div>Show Controls: {showControls ? 'Yes' : 'No'}</div>
    </div>
  );
};

import React from 'react';
import { UnifiedMap } from '../map/UnifiedMap';
import { LiveStatusPanel } from '../panels/LiveStatusPanel';
import { ReplayStatsPanel } from '../replay/ReplayStatsPanel';
import { TrackingMode } from '@/contexts/TrackingModeContext';
import { HistoricalPosition } from '@/lib/history-api';

interface MainContentAreaProps {
  mode: TrackingMode;
  liveData: {
    devices: any[];
    isLoading: boolean;
    error: string | null;
    lastUpdate: Date | null;
  };
  replayData: {
    positions: HistoricalPosition[];
    currentPosition: HistoricalPosition | null;
    currentTime: Date | null;
    dateRange: {
      from: Date;
      to: Date;
    };
  };
  replayDataFromHook: any;
  currentPosition: HistoricalPosition | null;
  replayLoading: boolean;
  replayError: string | Error | null;
}

export const MainContentArea: React.FC<MainContentAreaProps> = ({
  mode,
  liveData,
  replayData,
  replayDataFromHook,
  currentPosition,
  replayLoading,
  replayError
}) => {
  return (
    <div className="flex flex-1 min-h-0">
      {/* Map Area - Full width in replay mode, with side panel in live mode */}
      <div className={`relative ${mode === 'replay' ? 'flex-1' : 'flex-1'}`}>
        <UnifiedMap height="100%" />
      </div>

      {/* Side Panel - Only in live mode */}
      {mode === 'live' && (
        <div className="w-64 bg-card border-l border-border overflow-y-auto flex-shrink-0">
          <div className="p-2">
            <LiveStatusPanel data={liveData} />
          </div>
        </div>
      )}
    </div>
  );
};

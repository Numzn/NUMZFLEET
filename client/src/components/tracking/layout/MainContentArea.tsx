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
      {/* Map Area */}
      <div className="flex-1 relative">
        <UnifiedMap height="100%" />
      </div>

      {/* Side Panel */}
      <div className="w-64 bg-card border-l border-border overflow-y-auto flex-shrink-0">
        <div className="p-2">
          {mode === 'live' && (
            <LiveStatusPanel data={liveData} />
          )}
          
          {mode === 'replay' && (
            <ReplayStatsPanel
              replayData={replayDataFromHook}
              currentPosition={currentPosition}
              currentTime={replayData.currentTime || (replayData.positions.length > 0 ? new Date(replayData.positions[0].deviceTime) : null)}
              duration={replayData.positions.length > 1 ? 
                new Date(replayData.positions[replayData.positions.length - 1].deviceTime).getTime() - 
                new Date(replayData.positions[0].deviceTime).getTime() : 0
              }
              currentTimeMs={replayData.currentTime ? 
                replayData.currentTime.getTime() - new Date(replayData.positions[0]?.deviceTime || 0).getTime() : 0
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};

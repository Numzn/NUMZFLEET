import React from 'react';
import { PlaybackControls } from './replay/PlaybackControls';
import { Timeline } from './replay/Timeline';
import { HistoricalPosition } from '@/lib/history-api';

interface BottomControlBarProps {
  mode: 'live' | 'replay';
  selectedDeviceId: number | null;
  positions: HistoricalPosition[];
  replayData: {
    isPlaying: boolean;
    playbackSpeed: number;
    currentTime: Date | null;
  };
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSpeedChange: (speed: number) => void;
  onTimelineClick: (percentage: number) => void;
  progressPercentage: number;
  isLoading: boolean;
}

export const BottomControlBar: React.FC<BottomControlBarProps> = ({
  mode,
  selectedDeviceId,
  positions,
  replayData,
  onPlay,
  onPause,
  onStop,
  onStepBack,
  onStepForward,
  onSpeedChange,
  onTimelineClick,
  progressPercentage,
  isLoading
}) => {
  if (mode !== 'replay') return null;

  return (
    <div className="bg-card border-t border-border p-2 flex-shrink-0">
      <div className="flex items-center justify-between gap-2">
        {/* Show message when no device selected */}
        {!selectedDeviceId ? (
          <div className="flex-1 text-center text-muted-foreground">
            <p className="text-sm font-medium">Please select a device to view playback controls</p>
            <p className="text-xs">Choose a device from the dropdown above to start replay</p>
          </div>
        ) : positions.length === 0 ? (
          <div className="flex-1 text-center text-muted-foreground">
            <p className="text-sm font-medium">Loading historical data...</p>
            <p className="text-xs">Please wait while we fetch the replay data</p>
          </div>
        ) : (
          <>
            {/* Playback Controls */}
            <PlaybackControls
              isPlaying={replayData.isPlaying}
              currentSpeed={replayData.playbackSpeed}
              playbackSpeeds={[0.25, 0.5, 1, 2, 4, 8]}
              onPlay={onPlay}
              onPause={onPause}
              onStop={onStop}
              onStepBack={onStepBack}
              onStepForward={onStepForward}
              onSpeedChange={onSpeedChange}
              isLoading={isLoading}
            />
            
            {/* Timeline */}
            <div className="flex-1 mx-2">
              <Timeline
                progressPercentage={progressPercentage}
                currentTime={replayData.currentTime || (positions.length > 0 ? new Date(positions[0].deviceTime) : undefined)}
                totalDuration={positions.length > 1 ? 
                  (new Date(positions[positions.length - 1].deviceTime).getTime() - 
                   new Date(positions[0].deviceTime).getTime()) / 1000 : 0
                }
                onTimelineClick={onTimelineClick}
                isLoading={isLoading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

import { useCallback } from 'react';
import { useTrackingMode } from '@/contexts/TrackingModeContext';
import { HistoricalPosition } from '@/lib/history-api';

export const useReplayControls = () => {
  const {
    replayData,
    play,
    pause,
    stop,
    setPlaybackSpeed,
    jumpToTime,
    jumpToPosition
  } = useTrackingMode();

  const handleStepBack = useCallback(() => {
    const currentIndex = replayData.positions.findIndex((pos: HistoricalPosition) => 
      pos.deviceTime === replayData.currentPosition?.deviceTime
    );
    if (currentIndex > 0) {
      jumpToPosition(currentIndex - 1);
    }
  }, [replayData.positions, replayData.currentPosition, jumpToPosition]);

  const handleStepForward = useCallback(() => {
    const currentIndex = replayData.positions.findIndex((pos: HistoricalPosition) => 
      pos.deviceTime === replayData.currentPosition?.deviceTime
    );
    if (currentIndex < replayData.positions.length - 1) {
      jumpToPosition(currentIndex + 1);
    }
  }, [replayData.positions, replayData.currentPosition, jumpToPosition]);

  const handleTimelineClick = useCallback((percentage: number) => {
    if (replayData.positions.length > 0) {
      const startTime = new Date(replayData.positions[0].deviceTime).getTime();
      const endTime = new Date(replayData.positions[replayData.positions.length - 1].deviceTime).getTime();
      const targetTime = startTime + (endTime - startTime) * (percentage / 100);
      jumpToTime(new Date(targetTime));
    }
  }, [replayData.positions, jumpToTime]);

  return {
    handleStepBack,
    handleStepForward,
    handleTimelineClick,
    play,
    pause,
    stop,
    setPlaybackSpeed
  };
};

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { historyApi } from '@/lib/history-api';
import { HistoricalPosition } from '@/lib/history-api';
import { processEfficiencySegments, detectIdlePeriods, calculateEfficiencyStats, EfficiencySegment, IdlePeriod } from '@/utils/efficiency-scoring';

export interface ReplayState {
  isPlaying: boolean;
  currentTime: Date | null;
  playbackSpeed: number;
  selectedDeviceId: number | null;
  dateRange: {
    from: Date;
    to: Date;
  };
}

export interface ReplayData {
  positions: HistoricalPosition[];
  efficiencySegments: EfficiencySegment[];
  idlePeriods: IdlePeriod[];
  fuelData: HistoricalPosition[];
  stats: {
    totalPositions: number;
    totalDistance: number;
    totalDuration: number;
    averageSpeed: number;
    fuelStats: {
      startFuel: number;
      endFuel: number;
      totalUsed: number;
      refuelEvents: number;
    };
    efficiencyStats: ReturnType<typeof calculateEfficiencyStats>;
  };
}

const DEFAULT_PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
const DEFAULT_DATE_RANGE_DAYS = 30; // Increased from 7 to 30 days

export const useReplay = (initialDeviceId?: number) => {
  // Replay state
  const [replayState, setReplayState] = useState<ReplayState>({
    isPlaying: false,
    currentTime: null,
    playbackSpeed: 1,
    selectedDeviceId: initialDeviceId || null,
    dateRange: {
      from: new Date(Date.now() - DEFAULT_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000),
      to: new Date()
    }
  });

  // Update selectedDeviceId when initialDeviceId changes
  useEffect(() => {
    if (initialDeviceId && initialDeviceId !== replayState.selectedDeviceId) {
      console.log('🔄 useReplay: Device ID changed from', replayState.selectedDeviceId, 'to', initialDeviceId);
      setReplayState(prev => ({
        ...prev,
        selectedDeviceId: initialDeviceId,
        currentTime: null,
        isPlaying: false
      }));
    }
  }, [initialDeviceId, replayState.selectedDeviceId]);

  // Animation frame reference
  const animationFrameRef = useRef<number | null>(null);

  // Fetch historical data
  const { data: historicalData, isLoading, error, refetch } = useQuery({
    queryKey: ['replay-data', replayState.selectedDeviceId, replayState.dateRange.from, replayState.dateRange.to],
    queryFn: async () => {
      console.log('🔄 useReplay: Fetching data for device', replayState.selectedDeviceId, 'Date range:', replayState.dateRange.from, 'to', replayState.dateRange.to);
      if (!replayState.selectedDeviceId) {
        console.log('❌ useReplay: No device ID, returning null');
        return null;
      }
      
      try {
        const positions = await historyApi.getHistoricalPositions(
          replayState.selectedDeviceId,
          replayState.dateRange.from,
          replayState.dateRange.to
        );
        
        console.log('✅ useReplay: Fetched', positions.length, 'positions for device', replayState.selectedDeviceId);
        return positions;
      } catch (error) {
        console.error('❌ useReplay: Error fetching historical data:', error);
        throw error;
      }
    },
    enabled: !!replayState.selectedDeviceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });

  // Process data for replay
  const replayData = useMemo((): ReplayData | null => {
    console.log('🔄 useReplay: Processing replayData, historicalData length:', historicalData?.length || 0);
    if (!historicalData || historicalData.length === 0) {
      console.log('❌ useReplay: No historical data, returning null');
      return null;
    }

    // Only process efficiency if we have enough data points
    const efficiencySegments = historicalData.length > 1 ? processEfficiencySegments(historicalData) : [];
    const idlePeriods = historicalData.length > 1 ? detectIdlePeriods(historicalData) : [];
    const fuelData = historicalData.filter(pos => 
      pos.fuelLevel !== null && pos.fuelLevel !== undefined && pos.fuelLevel >= 0
    );

    // Calculate statistics
    const totalDistance = efficiencySegments.reduce((sum, seg) => sum + seg.distance, 0);
    const totalDuration = efficiencySegments.reduce((sum, seg) => sum + seg.duration, 0);
    const averageSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 60 : 0;
    
    // For single position, set duration to 0
    const actualTotalDuration = historicalData.length === 1 ? 0 : totalDuration;

    // Fuel statistics
    const fuelStats = fuelData.length > 0 ? {
      startFuel: fuelData[0].fuelLevel!,
      endFuel: fuelData[fuelData.length - 1].fuelLevel!,
      totalUsed: Math.max(0, fuelData[0].fuelLevel! - fuelData[fuelData.length - 1].fuelLevel!),
      refuelEvents: fuelData.filter((pos, index) => 
        index > 0 && pos.fuelLevel! > fuelData[index - 1].fuelLevel! + 5
      ).length
    } : {
      startFuel: 0,
      endFuel: 0,
      totalUsed: 0,
      refuelEvents: 0
    };

    const efficiencyStats = calculateEfficiencyStats(efficiencySegments);

    const result = {
      positions: historicalData,
      efficiencySegments,
      idlePeriods,
      fuelData,
      stats: {
        totalPositions: historicalData.length,
        totalDistance,
        totalDuration: actualTotalDuration,
        averageSpeed,
        fuelStats,
        efficiencyStats
      }
    };
    
    console.log('✅ useReplay: Processed replayData with', result.positions.length, 'positions');
    return result;
  }, [historicalData]);

  // Get current position based on replay time
  const currentPosition = useMemo(() => {
    if (!replayData || !replayState.currentTime) return null;

    const currentTime = replayState.currentTime.getTime();
    
    // Find the closest position to current time
    let closestPosition = replayData.positions[0];
    let minTimeDiff = Math.abs(new Date(closestPosition.deviceTime).getTime() - currentTime);

    for (const position of replayData.positions) {
      const timeDiff = Math.abs(new Date(position.deviceTime).getTime() - currentTime);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestPosition = position;
      }
    }

    return closestPosition;
  }, [replayData, replayState.currentTime]);

  // Playback controls
  const play = useCallback(() => {
    setReplayState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    setReplayState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const stop = useCallback(() => {
    setReplayState(prev => ({ 
      ...prev, 
      isPlaying: false, 
      currentTime: replayData ? new Date(replayData.positions[0].deviceTime) : null 
    }));
  }, [replayData]);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setReplayState(prev => ({ ...prev, playbackSpeed: speed }));
  }, []);

  const setCurrentTime = useCallback((time: Date) => {
    setReplayState(prev => ({ ...prev, currentTime: time }));
  }, []);

  const setDevice = useCallback((deviceId: number) => {
    console.log('🔄 useReplay: setDevice called with', deviceId);
    setReplayState(prev => ({ 
      ...prev, 
      selectedDeviceId: deviceId,
      currentTime: null,
      isPlaying: false
    }));
  }, []);

  const setDateRange = useCallback((from: Date, to: Date) => {
    setReplayState(prev => ({ 
      ...prev, 
      dateRange: { from, to },
      currentTime: null,
      isPlaying: false
    }));
  }, []);

  // Jump to specific time
  const jumpToTime = useCallback((time: Date) => {
    setCurrentTime(time);
  }, [setCurrentTime]);

  // Jump to specific position index
  const jumpToPosition = useCallback((index: number) => {
    if (!replayData || index < 0 || index >= replayData.positions.length) return;
    
    const position = replayData.positions[index];
    setCurrentTime(new Date(position.deviceTime));
  }, [replayData, setCurrentTime]);

  // Animation loop
  useEffect(() => {
    if (!replayState.isPlaying || !replayData) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const animate = () => {
      setReplayState(prev => {
        if (!prev.isPlaying || !replayData) return prev;

        const currentTime = prev.currentTime || new Date(replayData.positions[0].deviceTime);
        const nextTime = new Date(currentTime.getTime() + (1000 * prev.playbackSpeed));
        
        // Check if we've reached the end
        const endTime = new Date(replayData.positions[replayData.positions.length - 1].deviceTime);
        if (nextTime >= endTime) {
          return { ...prev, isPlaying: false, currentTime: endTime };
        }

        return { ...prev, currentTime: nextTime };
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [replayState.isPlaying, replayData, replayState.playbackSpeed]);

  // Initialize current time and position when data loads
  useEffect(() => {
    if (replayData && !replayState.currentTime && replayData.positions.length > 0) {
      console.log('🔄 useReplay: Initializing current time and position with first position');
      setCurrentTime(new Date(replayData.positions[0].deviceTime));
      jumpToPosition(0); // Jump to first position
    }
  }, [replayData, replayState.currentTime, setCurrentTime, jumpToPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  return {
    // State
    replayState,
    replayData,
    currentPosition,
    isLoading,
    error,
    
    // Controls
    play,
    pause,
    stop,
    setPlaybackSpeed,
    setCurrentTime,
    setDevice,
    setDateRange,
    jumpToTime,
    jumpToPosition,
    
    // Data
    playbackSpeeds: DEFAULT_PLAYBACK_SPEEDS,
    
    // Utilities
    refetch
  };
};

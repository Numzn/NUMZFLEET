import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Device } from '@/components/tracking/map/types';
import { HistoricalPosition } from '@/lib/history-api';

export type TrackingMode = 'live' | 'replay';

export interface ViewportState {
  center: [number, number];
  zoom: number;
}

export interface LiveDataState {
  devices: Device[];
  selectedDevice: Device | null;
  isLoading: boolean;
  lastUpdate: Date | null;
  error: string | null;
}

export interface ReplayDataState {
  isPlaying: boolean;
  currentTime: Date | null;
  playbackSpeed: number;
  dateRange: {
    from: Date;
    to: Date;
  };
  positions: HistoricalPosition[];
  currentPosition: HistoricalPosition | null;
  isLoading: boolean;
  error: string | null;
}

export interface TrackingModeState {
  // Mode Management
  mode: TrackingMode;
  
  // Live Mode State
  liveData: LiveDataState;
  
  // Replay Mode State
  replayData: ReplayDataState;
  
  // Shared State
  selectedDeviceId: number | null;
  viewport: ViewportState;
}

export interface TrackingModeContextType extends TrackingModeState {
  // Mode Management
  switchMode: (newMode: TrackingMode) => void;
  
  // Device Management
  setSelectedDeviceId: (deviceId: number | null) => void;
  setSelectedDevice: (device: Device | null) => void;
  
  // Viewport Management
  updateViewport: (viewport: Partial<ViewportState>) => void;
  
  // Live Data Management
  updateLiveData: (data: Partial<LiveDataState>) => void;
  
  // Replay Data Management
  updateReplayData: (data: Partial<ReplayDataState>) => void;
  
  // Replay Controls
  play: () => void;
  pause: () => void;
  stop: () => void;
  setPlaybackSpeed: (speed: number) => void;
  jumpToTime: (time: Date) => void;
  jumpToPosition: (index: number) => void;
  setDateRange: (from: Date, to: Date) => void;
  
  // Utility Functions
  resetToLiveMode: () => void;
  switchToReplayForDevice: (deviceId: number) => void;
}

const TrackingModeContext = createContext<TrackingModeContextType | undefined>(undefined);

interface TrackingModeProviderProps {
  children: ReactNode;
}

export const TrackingModeProvider: React.FC<TrackingModeProviderProps> = ({ children }) => {
  // Initial state
  const [state, setState] = useState<TrackingModeState>({
    mode: 'live',
    liveData: {
      devices: [],
      selectedDevice: null,
      isLoading: false,
      lastUpdate: null,
      error: null,
    },
    replayData: {
      isPlaying: false,
      currentTime: null,
      playbackSpeed: 1,
      dateRange: {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        to: new Date(),
      },
      positions: [],
      currentPosition: null,
      isLoading: false,
      error: null,
    },
    selectedDeviceId: null,
    viewport: {
      center: [-15.386024386774672, 28.3081738740988], // Default center
      zoom: 13,
    },
  });

  // Mode Management
  const switchMode = useCallback((newMode: TrackingMode) => {
    setState(prev => ({
      ...prev,
      mode: newMode,
      // Reset replay state when switching to live
      ...(newMode === 'live' && {
        replayData: {
          ...prev.replayData,
          isPlaying: false,
          currentTime: null,
          currentPosition: null,
        }
      })
    }));
  }, []);

  // Device Management
  const setSelectedDeviceId = useCallback((deviceId: number | null) => {
    setState(prev => ({
      ...prev,
      selectedDeviceId: deviceId,
      // Update selected device in live data
      liveData: {
        ...prev.liveData,
        selectedDevice: deviceId 
          ? prev.liveData.devices.find(d => d.id === deviceId) || null
          : null
      }
    }));
  }, []);

  const setSelectedDevice = useCallback((device: Device | null) => {
    setState(prev => ({
      ...prev,
      selectedDeviceId: device?.id || null,
      liveData: {
        ...prev.liveData,
        selectedDevice: device
      }
    }));
  }, []);

  // Viewport Management
  const updateViewport = useCallback((viewport: Partial<ViewportState>) => {
    setState(prev => ({
      ...prev,
      viewport: { ...prev.viewport, ...viewport }
    }));
  }, []);

  // Live Data Management
  const updateLiveData = useCallback((data: Partial<LiveDataState>) => {
    setState(prev => ({
      ...prev,
      liveData: { ...prev.liveData, ...data }
    }));
  }, []);

  // Replay Data Management
  const updateReplayData = useCallback((data: Partial<ReplayDataState>) => {
    setState(prev => ({
      ...prev,
      replayData: { ...prev.replayData, ...data }
    }));
  }, []);

  // Replay Controls
  const play = useCallback(() => {
    setState(prev => ({
      ...prev,
      replayData: { ...prev.replayData, isPlaying: true }
    }));
  }, []);

  const pause = useCallback(() => {
    setState(prev => ({
      ...prev,
      replayData: { ...prev.replayData, isPlaying: false }
    }));
  }, []);

  const stop = useCallback(() => {
    setState(prev => ({
      ...prev,
      replayData: {
        ...prev.replayData,
        isPlaying: false,
        currentTime: prev.replayData.positions.length > 0 
          ? new Date(prev.replayData.positions[0].deviceTime)
          : null,
        currentPosition: prev.replayData.positions.length > 0 
          ? prev.replayData.positions[0]
          : null
      }
    }));
  }, []);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setState(prev => ({
      ...prev,
      replayData: { ...prev.replayData, playbackSpeed: speed }
    }));
  }, []);

  const jumpToTime = useCallback((time: Date) => {
    setState(prev => {
      const positions = prev.replayData.positions;
      if (positions.length === 0) return prev;

      // Find closest position to the target time
      const closestPosition = positions.reduce((closest, pos) => {
        const posTime = new Date(pos.deviceTime).getTime();
        const closestTime = new Date(closest.deviceTime).getTime();
        const targetTime = time.getTime();
        
        return Math.abs(posTime - targetTime) < Math.abs(closestTime - targetTime) 
          ? pos : closest;
      });

      return {
        ...prev,
        replayData: {
          ...prev.replayData,
          currentTime: time,
          currentPosition: closestPosition
        }
      };
    });
  }, []);

  const jumpToPosition = useCallback((index: number) => {
    setState(prev => {
      const positions = prev.replayData.positions;
      if (index < 0 || index >= positions.length) return prev;

      const position = positions[index];
      return {
        ...prev,
        replayData: {
          ...prev.replayData,
          currentTime: new Date(position.deviceTime),
          currentPosition: position
        }
      };
    });
  }, []);

  const setDateRange = useCallback((from: Date, to: Date) => {
    setState(prev => ({
      ...prev,
      replayData: {
        ...prev.replayData,
        dateRange: { from, to },
        // Reset current position when date range changes
        currentTime: null,
        currentPosition: null,
        isPlaying: false
      }
    }));
  }, []);

  // Utility Functions
  const resetToLiveMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'live',
      replayData: {
        ...prev.replayData,
        isPlaying: false,
        currentTime: null,
        currentPosition: null,
      }
    }));
  }, []);

  const switchToReplayForDevice = useCallback((deviceId: number) => {
    setState(prev => ({
      ...prev,
      mode: 'replay',
      selectedDeviceId: deviceId,
      replayData: {
        ...prev.replayData,
        isPlaying: false,
        currentTime: null,
        currentPosition: null,
      }
    }));
  }, []);

  const contextValue: TrackingModeContextType = {
    ...state,
    switchMode,
    setSelectedDeviceId,
    setSelectedDevice,
    updateViewport,
    updateLiveData,
    updateReplayData,
    play,
    pause,
    stop,
    setPlaybackSpeed,
    jumpToTime,
    jumpToPosition,
    setDateRange,
    resetToLiveMode,
    switchToReplayForDevice,
  };

  return (
    <TrackingModeContext.Provider value={contextValue}>
      {children}
    </TrackingModeContext.Provider>
  );
};

export const useTrackingMode = (): TrackingModeContextType => {
  const context = useContext(TrackingModeContext);
  if (context === undefined) {
    throw new Error('useTrackingMode must be used within a TrackingModeProvider');
  }
  return context;
};



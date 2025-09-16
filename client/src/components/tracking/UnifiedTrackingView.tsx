import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTrackingMode } from '@/contexts/TrackingModeContext';
import { useDeviceData } from '@/components/tracking/map/useDeviceData';
import { useReplay } from '@/hooks/use-replay';
import { UnifiedMap } from '@/components/tracking/map/UnifiedMap';
import { ModeToggle } from '@/components/tracking/controls/ModeToggle';
import { DeviceSelector } from '@/components/tracking/controls/DeviceSelector';
import { DateRangePicker } from '@/components/tracking/controls/replay/DateRangePicker';
import { PlaybackControls } from '@/components/tracking/controls/replay/PlaybackControls';
import { Timeline } from '@/components/tracking/controls/replay/Timeline';
import { ReplayStats } from '@/components/tracking/controls/replay/ReplayStats';
import { LiveStatusPanel } from '@/components/tracking/panels/LiveStatusPanel';
import { ReplayStatsPanel } from '@/components/tracking/replay/ReplayStatsPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MapPin } from 'lucide-react';

interface UnifiedTrackingViewProps {
  className?: string;
  height?: string;
}

export const UnifiedTrackingView: React.FC<UnifiedTrackingViewProps> = ({
  className = '',
  height = '100vh'
}) => {
  const {
    mode,
    switchMode,
    selectedDeviceId,
    setSelectedDeviceId,
    updateLiveData,
    updateReplayData,
    liveData,
    replayData,
    play,
    pause,
    stop,
    setPlaybackSpeed,
    jumpToTime,
    jumpToPosition,
    setDateRange
  } = useTrackingMode();

  // Live data fetching
  const { 
    devices: liveDevices, 
    allDevicesForReplay,
    isLoading: liveLoading, 
    error: liveError,
    refetch: refetchLive 
  } = useDeviceData();

  // Replay data fetching
  const {
    replayData: replayDataFromHook,
    replayState,
    currentPosition,
    play: playReplay,
    pause: pauseReplay,
    stop: stopReplay,
    setPlaybackSpeed: setReplaySpeed,
    jumpToTime: jumpToReplayTime,
    jumpToPosition: jumpToReplayPosition,
    setDateRange: setReplayDateRange,
    isLoading: replayLoading,
    error: replayError
  } = useReplay(selectedDeviceId);

  // Update live data in context
  useEffect(() => {
    console.log('🔍 Live devices loaded:', liveDevices.length, 'All devices for replay:', allDevicesForReplay.length);
    updateLiveData({
      devices: liveDevices,
      isLoading: liveLoading,
      error: liveError,
      lastUpdate: new Date()
    });
  }, [liveDevices, liveLoading, liveError, updateLiveData, allDevicesForReplay]);

  // Update replay data in context
  useEffect(() => {
    console.log('🔄 Updating replay data - Hook data:', !!replayDataFromHook, 'Positions:', replayDataFromHook?.positions?.length || 0, 'Current position:', !!currentPosition, 'Loading:', replayLoading);
    if (replayDataFromHook) {
      updateReplayData({
        positions: replayDataFromHook.positions || [],
        currentPosition: currentPosition,
        isLoading: replayLoading,
        error: replayError
      });
    }
  }, [replayDataFromHook, currentPosition, replayLoading, replayError, updateReplayData]);

  // Sync replay controls
  useEffect(() => {
    if (mode === 'replay') {
      // Sync context state with hook state
      if (replayState.isPlaying !== replayData.isPlaying) {
        if (replayState.isPlaying) {
          playReplay();
        } else {
          pauseReplay();
        }
      }
    }
  }, [mode, replayState.isPlaying, replayData.isPlaying, playReplay, pauseReplay]);

  // Handle device selection
  const handleDeviceSelect = (deviceId: number | null) => {
    console.log('🔍 Device selected:', deviceId, 'Available devices:', allDevicesForReplay.length);
    setSelectedDeviceId(deviceId);
    
    // Auto-switch to replay mode when a device is selected
    if (deviceId && mode !== 'replay') {
      console.log('🔄 Auto-switching to replay mode for device:', deviceId);
      switchMode('replay');
    }
  };

  // Handle mode switching
  const handleModeSwitch = (newMode: 'live' | 'replay') => {
    console.log('🔄 Switching to mode:', newMode, 'Selected device:', selectedDeviceId);
    switchMode(newMode);
    
    // If switching to replay and no device selected, show message
    if (newMode === 'replay' && !selectedDeviceId) {
      // Could show a toast or modal here
      console.log('⚠️ Please select a device for replay mode');
    }
  };

  // Calculate progress for replay mode
  const progressPercentage = React.useMemo(() => {
    if (mode !== 'replay' || !replayData.positions.length || !replayData.currentTime) {
      return 0;
    }
    
    const startTime = new Date(replayData.positions[0].deviceTime).getTime();
    const endTime = new Date(replayData.positions[replayData.positions.length - 1].deviceTime).getTime();
    const currentTime = replayData.currentTime.getTime();
    
    return ((currentTime - startTime) / (endTime - startTime)) * 100;
  }, [mode, replayData.positions, replayData.currentTime]);

  console.log('🔍 UnifiedTrackingView render - Mode:', mode, 'Selected device:', selectedDeviceId, 'Replay data positions:', replayData.positions.length, 'Should show controls:', mode === 'replay');

  return (
    <div className={`w-full h-full ${className}`} style={{ height }}> {/* eslint-disable-line react/forbid-dom-props */}
      {/* Top Control Bar */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Mode Toggle */}
            <ModeToggle 
              mode={mode} 
              onModeChange={handleModeSwitch}
            />
            
            {/* Device Selector */}
            <DeviceSelector
              devices={allDevicesForReplay}
              selectedDeviceId={selectedDeviceId}
              onDeviceSelect={handleDeviceSelect}
            />
            
            {/* Date Range Picker - Only in replay mode */}
            {mode === 'replay' && (
              <DateRangePicker
                fromDate={replayData.dateRange.from}
                toDate={replayData.dateRange.to}
                onDateChange={setDateRange}
                isLoading={replayLoading}
              />
            )}
          </div>
          
          {/* Status Indicator */}
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            {mode === 'live' ? (
              <>
                <MapPin className="w-4 h-4" />
                <span>Live Tracking</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>Replay Mode</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Map Area */}
        <div className="flex-1 relative">
          <UnifiedMap height="100%" />
        </div>

        {/* Side Panel */}
        <div className="w-80 bg-card border-l border-border overflow-y-auto">
          <div className="p-4">
            {mode === 'live' && (
              <LiveStatusPanel data={liveData} />
            )}
            
            {mode === 'replay' && (
              <ReplayStatsPanel
                replayData={replayDataFromHook}
                currentPosition={currentPosition}
                currentTime={replayData.currentTime}
                duration={replayData.positions.length > 0 ? 
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

      {/* Bottom Control Bar - Only in replay mode */}
      {mode === 'replay' && (
        <div className="bg-card border-t border-border p-4" style={{ backgroundColor: '#ff0000', minHeight: '80px' }}>
          {console.log('🎮 Rendering playback controls for replay mode - Device selected:', selectedDeviceId)}
          <div className="flex items-center justify-between">
            {/* Show message when no device selected */}
            {!selectedDeviceId ? (
              <div className="flex-1 text-center text-muted-foreground">
                <p className="text-lg font-medium">Please select a device to view playback controls</p>
                <p className="text-sm">Choose a device from the dropdown above to start replay</p>
              </div>
            ) : (
              <>
                {/* Playback Controls */}
                <PlaybackControls
              isPlaying={replayData.isPlaying}
              currentSpeed={replayData.playbackSpeed}
              playbackSpeeds={[0.25, 0.5, 1, 2, 4, 8]}
              onPlay={play}
              onPause={pause}
              onStop={stop}
              onStepBack={() => {
                // Implement step back logic
                const currentIndex = replayData.positions.findIndex((pos: any) => 
                  pos.deviceTime === replayData.currentPosition?.deviceTime
                );
                if (currentIndex > 0) {
                  jumpToPosition(currentIndex - 1);
                }
              }}
              onStepForward={() => {
                // Implement step forward logic
                const currentIndex = replayData.positions.findIndex((pos: any) => 
                  pos.deviceTime === replayData.currentPosition?.deviceTime
                );
                if (currentIndex < replayData.positions.length - 1) {
                  jumpToPosition(currentIndex + 1);
                }
              }}
              onSpeedChange={setPlaybackSpeed}
              isLoading={replayLoading}
            />
            
            {/* Timeline */}
            <div className="flex-1 mx-4">
              <Timeline
                currentTime={replayData.currentTime}
                startTime={replayData.positions.length > 0 ? new Date(replayData.positions[0].deviceTime) : null}
                endTime={replayData.positions.length > 0 ? new Date(replayData.positions[replayData.positions.length - 1].deviceTime) : null}
                onTimeChange={(time) => jumpToTime(time)}
                isLoading={replayLoading}
              />
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

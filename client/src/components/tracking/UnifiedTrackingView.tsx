import React, { useEffect } from 'react';
import { useTrackingMode } from '@/contexts/TrackingModeContext';
import { useDeviceData } from '@/components/tracking/map/useDeviceData';
import { useReplay } from '@/hooks/use-replay';
import { useReplayControls } from '@/hooks/useReplayControls';
import { TopControlBar } from '@/components/tracking/controls/TopControlBar';
import { MainContentArea } from '@/components/tracking/layout/MainContentArea';
import { BottomControlBar } from '@/components/tracking/controls/BottomControlBar';
import { DebugPanel } from '@/components/tracking/debug/DebugPanel';

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
    setDateRange: setReplayDateRange,
    isLoading: replayLoading,
    error: replayError
  } = useReplay(selectedDeviceId || undefined);

  // Replay controls
  const {
    handleStepBack,
    handleStepForward,
    handleTimelineClick,
    play,
    pause,
    stop,
    setPlaybackSpeed
  } = useReplayControls();

  console.log('🔍 Hook data structure:', {
    replayDataFromHook: !!replayDataFromHook,
    positions: replayDataFromHook?.positions?.length || 0,
    replayState: replayState,
    currentPosition: !!currentPosition
  });

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
    
    // Force update the context with current data
    const positions = replayDataFromHook?.positions || [];
    console.log('🔄 Force updating context with positions:', positions.length);
    
    // Use current position from hook, or fallback to first position if available
    const effectiveCurrentPosition = currentPosition || (positions.length > 0 ? positions[0] : null);
    
    updateReplayData({
      positions: positions,
      currentPosition: effectiveCurrentPosition,
      isLoading: replayLoading,
      error: replayError?.message || (replayError as unknown as string) || null
    });
  }, [replayDataFromHook, currentPosition, replayLoading, replayError, updateReplayData]);

  // Sync replay controls
  useEffect(() => {
    if (mode === 'replay') {
      // Sync context state with hook state
      if (replayState.isPlaying !== replayData.isPlaying) {
        if (replayState.isPlaying) {
          play();
        } else {
          pause();
        }
      }
    }
  }, [mode, replayState.isPlaying, replayData.isPlaying, play, pause]);

  // No need to sync date range - use hook's date range directly

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
    const positions = replayDataFromHook?.positions || replayData.positions;
    const currentTime = replayState.currentTime || replayData.currentTime;
    
    if (mode !== 'replay' || !positions.length || !currentTime) {
      return 0;
    }
    
    const startTime = new Date(positions[0].deviceTime).getTime();
    const endTime = new Date(positions[positions.length - 1].deviceTime).getTime();
    const currentTimeMs = currentTime.getTime();
    
    return ((currentTimeMs - startTime) / (endTime - startTime)) * 100;
  }, [mode, replayDataFromHook?.positions, replayData.positions, replayState.currentTime, replayData.currentTime]);

  console.log('🔍 UnifiedTrackingView render - Mode:', mode, 'Selected device:', selectedDeviceId, 'Replay data positions:', replayData.positions.length, 'Should show controls:', mode === 'replay');

  return (
    <div className={`w-full h-full flex flex-col ${className}`} style={{ height }}> {/* eslint-disable-line react/forbid-dom-props, react/forbid-elements */}
      {/* Debug Panel */}
      <DebugPanel
        mode={mode}
        selectedDeviceId={selectedDeviceId}
        positionsCount={replayDataFromHook?.positions?.length || replayData.positions.length}
        isLoading={replayLoading}
        error={replayError}
        showControls={mode === 'replay'}
      />
      
      {/* Top Control Bar */}
      <TopControlBar
        mode={mode}
        onModeChange={handleModeSwitch}
        devices={allDevicesForReplay}
        selectedDeviceId={selectedDeviceId}
        onDeviceSelect={handleDeviceSelect}
        replayData={{
          dateRange: replayState.dateRange || replayData.dateRange
        }}
        onDateRangeChange={setReplayDateRange}
        isLoading={replayLoading}
      />

      {/* Main Content Area */}
      <MainContentArea
        mode={mode}
        liveData={liveData}
        replayData={{
          ...replayData,
          dateRange: replayState.dateRange || replayData.dateRange
        }}
        replayDataFromHook={replayDataFromHook}
        currentPosition={currentPosition}
        replayLoading={replayLoading}
        replayError={replayError}
      />

      {/* Bottom Control Bar */}
      <BottomControlBar
        mode={mode}
        selectedDeviceId={selectedDeviceId}
        positions={replayDataFromHook?.positions || replayData.positions}
        replayData={{
          ...replayData,
          isPlaying: replayState.isPlaying,
          playbackSpeed: replayState.playbackSpeed,
          currentTime: replayState.currentTime
        }}
        onPlay={play}
        onPause={pause}
        onStop={stop}
        onStepBack={handleStepBack}
        onStepForward={handleStepForward}
        onSpeedChange={setPlaybackSpeed}
        onTimelineClick={handleTimelineClick}
        progressPercentage={progressPercentage}
        isLoading={replayLoading}
      />
    </div>
  );
};


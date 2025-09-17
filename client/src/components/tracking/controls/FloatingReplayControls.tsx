import React, { useState } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Zap, Clock, MapPin, Gauge, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HistoricalPosition } from '@/lib/history-api';

interface FloatingReplayControlsProps {
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

export const FloatingReplayControls: React.FC<FloatingReplayControlsProps> = ({
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
  const [showStats, setShowStats] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const playbackSpeeds = [0.25, 0.5, 1, 2, 4, 8];

  const formatTime = (time: Date | null) => {
    if (!time) return '--:--';
    return time.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (duration: number) => {
    if (!duration || duration === 0) return '00:00';
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const totalDuration = positions.length > 1 ? 
    (new Date(positions[positions.length - 1].deviceTime).getTime() - 
     new Date(positions[0].deviceTime).getTime()) / 1000 : 0;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLoading) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    onTimelineClick(Math.max(0, Math.min(100, percentage)));
  };

  if (!selectedDeviceId) {
    return (
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border shadow-lg">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-muted-foreground">Please select a device to view playback controls</p>
            <p className="text-xs text-muted-foreground mt-1">Choose a device from the dropdown above to start replay</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border shadow-lg">
          <CardContent className="p-4 text-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm font-medium">Loading historical data...</p>
            <p className="text-xs text-muted-foreground">Please wait while we fetch the replay data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Main Controls - Bottom Center */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              {/* Playback Controls */}
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onStepBack}
                  disabled={isLoading}
                  className="h-8 w-8"
                  title="Step Back"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                
                {replayData.isPlaying ? (
                  <Button
                    onClick={onPause}
                    disabled={isLoading}
                    className="h-8 w-8 bg-red-500 hover:bg-red-600 text-white"
                    title="Pause"
                  >
                    <Pause className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={onPlay}
                    disabled={isLoading}
                    className="h-8 w-8 bg-green-500 hover:bg-green-600 text-white"
                    title="Play"
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onStop}
                  disabled={isLoading}
                  className="h-8 w-8"
                  title="Stop"
                >
                  <Square className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onStepForward}
                  disabled={isLoading}
                  className="h-8 w-8"
                  title="Step Forward"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              {/* Speed Control */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  disabled={isLoading}
                  className="h-8 px-3 flex items-center space-x-1"
                >
                  <Zap className="w-3 h-3" />
                  <span className="text-xs">{replayData.playbackSpeed}x</span>
                </Button>
                
                {showSpeedMenu && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-2 z-[9999] min-w-[120px]">
                    <div className="grid grid-cols-3 gap-1">
                      {playbackSpeeds.map((speed) => (
                        <Button
                          key={speed}
                          variant={replayData.playbackSpeed === speed ? "default" : "ghost"}
                          size="sm"
                          onClick={() => {
                            onSpeedChange(speed);
                            setShowSpeedMenu(false);
                          }}
                          className="h-6 text-xs"
                        >
                          {speed}x
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowStats(!showStats)}
                className="h-8 w-8"
                title="Toggle Stats"
              >
                {showStats ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
            </div>

            {/* Timeline */}
            <div className="mt-3 w-full max-w-md">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{formatTime(replayData.currentTime)}</span>
                <span>{formatDuration(totalDuration)}</span>
              </div>
              
              <div
                className="relative h-2 bg-muted rounded-full cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={handleTimelineClick}
                role="slider"
                aria-label="Timeline scrubber"
                aria-valuenow={Math.round(progressPercentage)}
                aria-valuemin="0"
                aria-valuemax="100"
                tabIndex={0}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-100"
                  style={{ width: `${progressPercentage}%` }}
                />
                <div
                  className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-primary rounded-full border-2 border-background shadow-lg hover:scale-110 transition-transform"
                  style={{ left: `calc(${progressPercentage}% - 8px)` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Stats Panel - Top Right */}
      {showStats && (
        <div className="absolute top-4 right-4 z-50 max-w-sm">
          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border shadow-lg">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Replay Stats
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowStats(false)}
                    className="h-6 w-6"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Current Time</div>
                    <div className="font-bold text-lg">{formatTime(replayData.currentTime)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Duration</div>
                    <div className="font-bold text-lg">{formatDuration(totalDuration)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Progress</div>
                    <div className="font-bold text-lg">{progressPercentage.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Speed</div>
                    <div className="font-bold text-lg flex items-center">
                      <Zap className="w-3 h-3 mr-1" />
                      {replayData.playbackSpeed}x
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Total Positions</span>
                    <span className="font-semibold">{positions.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Efficiency Segments</span>
                    <span className="font-semibold">0</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

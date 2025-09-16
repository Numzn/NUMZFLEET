import React from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ReplayControlPanelProps {
  isPlaying: boolean;
  playbackSpeed: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSpeedChange: (speed: number) => void;
  onTimelineClick: (percentage: number) => void;
  progressPercentage: number;
  className?: string;
}

export const ReplayControlPanel: React.FC<ReplayControlPanelProps> = ({
  isPlaying,
  playbackSpeed,
  onPlay,
  onPause,
  onStop,
  onStepBack,
  onStepForward,
  onSpeedChange,
  onTimelineClick,
  progressPercentage,
  className = ''
}) => {
  const playbackSpeeds = [0.25, 0.5, 1, 2, 4, 8];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Replay Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Playback Buttons */}
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onStepBack}
            title="Step Back"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          
          <Button
            variant={isPlaying ? "destructive" : "default"}
            size="icon"
            onClick={isPlaying ? onPause : onPlay}
            title={isPlaying ? "Pause" : "Play"}
            className="w-12 h-12"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={onStop}
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={onStepForward}
            title="Step Forward"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Speed Control */}
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4" />
          <span className="text-sm font-medium">Speed:</span>
          <div className="flex space-x-1">
            {playbackSpeeds.map((speed) => (
              <Button
                key={speed}
                variant={playbackSpeed === speed ? "default" : "outline"}
                size="sm"
                onClick={() => onSpeedChange(speed)}
                className="text-xs"
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{progressPercentage.toFixed(1)}%</span>
          </div>
          <div
            className="w-full h-2 bg-gray-200 rounded-full cursor-pointer hover:bg-gray-300 transition-colors"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percentage = ((e.clientX - rect.left) / rect.width) * 100;
              onTimelineClick(percentage);
            }}
          >
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-100"
              style={{ width: `${Math.max(0, Math.min(100, progressPercentage))}%` }} // eslint-disable-line react/forbid-dom-props
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};



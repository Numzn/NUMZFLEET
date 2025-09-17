import React, { useEffect, useRef } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentSpeed: number;
  playbackSpeeds: number[];
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSpeedChange: (speed: number) => void;
  isLoading?: boolean;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentSpeed,
  playbackSpeeds,
  onPlay,
  onPause,
  onStop,
  onStepBack,
  onStepForward,
  onSpeedChange,
  isLoading = false
}) => {
  const [showSpeedMenu, setShowSpeedMenu] = React.useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  // Close speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setShowSpeedMenu(false);
      }
    };

    if (showSpeedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpeedMenu]);

  return (
    <div className="space-y-1">
      {/* Main Controls */}
      <div className="flex items-center justify-center space-x-1">
        <Button
          variant="outline"
          size="icon"
          onClick={onStepBack}
          disabled={isLoading}
          className="h-5 w-5"
          title="Step Back"
        >
          <SkipBack className="w-2.5 h-2.5" />
        </Button>
        
        {isPlaying ? (
          <Button
            onClick={onPause}
            disabled={isLoading}
            className="h-5 w-5 bg-red-500 hover:bg-red-600 text-white"
            title="Pause"
          >
            <Pause className="w-2.5 h-2.5" />
          </Button>
        ) : (
          <Button
            onClick={onPlay}
            disabled={isLoading}
            className="h-5 w-5 bg-green-500 hover:bg-green-600 text-white"
            title="Play"
          >
            <Play className="w-2.5 h-2.5" />
          </Button>
        )}
        
        <Button
          variant="outline"
          size="icon"
          onClick={onStop}
          disabled={isLoading}
          className="h-5 w-5"
          title="Stop"
        >
          <Square className="w-2.5 h-2.5" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={onStepForward}
          disabled={isLoading}
          className="h-5 w-5"
          title="Step Forward"
        >
          <SkipForward className="w-2.5 h-2.5" />
        </Button>
      </div>

      {/* Speed Control */}
      <div className="relative flex items-center justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          disabled={isLoading}
          className="h-5 text-xs flex items-center space-x-1"
        >
          <Zap className="w-2.5 h-2.5" />
          <span>{currentSpeed}x</span>
        </Button>
        
        {showSpeedMenu && (
          <div ref={speedMenuRef} className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-1 z-[9999] min-w-[80px]">
            <div className="grid grid-cols-3 gap-1">
              {playbackSpeeds.map((speed) => (
                <Button
                  key={speed}
                  variant={currentSpeed === speed ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    onSpeedChange(speed);
                    setShowSpeedMenu(false);
                  }}
                  className="h-5 text-xs"
                >
                  {speed}x
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

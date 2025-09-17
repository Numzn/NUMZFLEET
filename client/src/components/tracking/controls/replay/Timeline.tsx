import React from 'react';

interface TimelineProps {
  progressPercentage: number;
  currentTime?: Date;
  totalDuration?: number;
  onTimelineClick: (percentage: number) => void;
  isLoading?: boolean;
}

export const Timeline: React.FC<TimelineProps> = ({
  progressPercentage,
  currentTime,
  totalDuration,
  onTimelineClick,
  isLoading = false
}) => {
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLoading) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    onTimelineClick(Math.max(0, Math.min(100, percentage)));
  };

  const formatTime = (time?: Date) => {
    if (!time) return '--:--';
    return time.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration || duration === 0) return '00:00';
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <span>{formatDuration(totalDuration)}</span>
      </div>
      
      <div
        className="relative h-1.5 bg-muted rounded-full cursor-pointer hover:bg-muted/80 transition-colors"
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
          className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-background shadow-lg"
          style={{ left: `calc(${progressPercentage}% - 6px)` }}
        />
      </div>
    </div>
  );
};

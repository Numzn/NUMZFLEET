import React from 'react';
import { Clock, Zap, Fuel, TrendingUp, MapPin, Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReplayStatsPanelProps {
  replayData: any;
  currentPosition: any;
  currentTime: Date | null;
  duration: number;
  currentTimeMs: number;
  className?: string;
}

export const ReplayStatsPanel: React.FC<ReplayStatsPanelProps> = ({
  replayData,
  currentPosition,
  currentTime,
  duration,
  currentTimeMs,
  className = ''
}) => {
  if (!replayData) return null;

  const formatTime = (time: Date | null) => {
    if (!time) return '00:00:00';
    return time.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTimeMs / duration) * 100 : (replayData.positions.length === 1 ? 100 : 0);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            Replay Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Time Info */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Current Time</div>
              <div className="text-lg font-bold">{formatTime(currentTime)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Total Duration</div>
              <div className="text-lg font-bold">{formatDuration(duration)}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Progress</span>
              <span>{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-100"
                style={{ width: `${Math.max(0, Math.min(100, progressPercentage))}%` }} // eslint-disable-line react/forbid-dom-props
              />
            </div>
          </div>

          {/* Position Info */}
          {currentPosition && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Current Speed</div>
                <div className="text-sm font-bold flex items-center">
                  <Gauge className="w-3 h-3 mr-1" />
                  {currentPosition.speed?.toFixed(0) || 0} km/h
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Position</div>
                <div className="text-xs font-mono">
                  {currentPosition.latitude?.toFixed(6)}, {currentPosition.longitude?.toFixed(6)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            Data Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Total Positions</div>
              <div className="text-lg font-bold">{replayData.positions.length}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Efficiency Segments</div>
              <div className="text-lg font-bold">{replayData.efficiencySegments?.length || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fuel Stats */}
      {replayData.fuelData && replayData.fuelData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Fuel className="w-5 h-5 mr-2" />
              Fuel Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Current Level</div>
                <div className="text-2xl font-bold text-blue-600">
                  {currentPosition?.fuelLevel?.toFixed(1) || 0}%
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Total Used</div>
                <div className="text-2xl font-bold text-red-600">
                  {replayData.stats?.fuelStats?.totalUsed?.toFixed(1) || 0}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Efficiency Stats */}
      {replayData.efficiencySegments && replayData.efficiencySegments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Efficiency Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Average Score</div>
                <div className="text-2xl font-bold text-green-600">
                  {replayData.stats?.efficiencyStats?.averageScore?.toFixed(1) || 0}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Total Distance</div>
                <div className="text-2xl font-bold">
                  {replayData.stats?.totalDistance?.toFixed(1) || 0} km
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};



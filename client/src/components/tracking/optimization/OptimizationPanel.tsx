import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Zap, 
  TrendingDown, 
  Clock, 
  Gauge, 
  MapPin,
  Activity,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useOptimizationSettings, useOptimizationPerformance } from '@/hooks/use-optimized-traccar';
import { OptimizationOptions } from '@/lib/optimized-traccar';

interface OptimizationPanelProps {
  deviceId?: number;
  onSettingsChange?: (settings: OptimizationOptions) => void;
  className?: string;
}

export const OptimizationPanel: React.FC<OptimizationPanelProps> = ({
  deviceId,
  onSettingsChange,
  className = ''
}) => {
  const { settings, updateSettings, resetSettings } = useOptimizationSettings();
  const { performanceData, recordOptimization, resetPerformance } = useOptimizationPerformance();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSettingChange = (key: keyof OptimizationOptions, value: any) => {
    updateSettings({ [key]: value });
    onSettingsChange?.(settings);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Coordinate Optimization
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {performanceData.totalOptimizations} optimizations
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Performance Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {formatPercentage(performanceData.averageReduction)}
            </div>
            <div className="text-xs text-muted-foreground">Avg Reduction</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatBytes(performanceData.bandwidthSaved * 1000)}
            </div>
            <div className="text-xs text-muted-foreground">Bandwidth Saved</div>
          </div>
        </div>

        {/* Last Optimization Result */}
        {performanceData.lastOptimization && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Last Optimization</span>
              <Badge variant="secondary">
                {formatPercentage(performanceData.lastOptimization.reductionPercentage)}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>{performanceData.lastOptimization.originalCount} → {performanceData.lastOptimization.optimizedCount} points</div>
              <div>Douglas-Peucker: {performanceData.lastOptimization.statistics.douglasPeuckerReduced} removed</div>
            </div>
          </div>
        )}

        {isExpanded && (
          <>
            <Separator />
            
            {/* Optimization Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                Optimization Settings
              </h4>

              {/* Tolerance Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Tolerance</label>
                  <span className="text-sm text-muted-foreground">{settings.tolerance}m</span>
                </div>
                <Slider
                  value={[settings.tolerance || 10]}
                  onValueChange={([value]) => handleSettingChange('tolerance', value)}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="text-xs text-muted-foreground">
                  Higher values = more aggressive optimization
                </div>
              </div>

              {/* Speed Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Min Speed</label>
                    <span className="text-sm text-muted-foreground">{settings.minSpeed} km/h</span>
                  </div>
                  <Slider
                    value={[settings.minSpeed || 5]}
                    onValueChange={([value]) => handleSettingChange('minSpeed', value)}
                    min={0}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Max Speed</label>
                    <span className="text-sm text-muted-foreground">{settings.maxSpeed} km/h</span>
                  </div>
                  <Slider
                    value={[settings.maxSpeed || 200]}
                    onValueChange={([value]) => handleSettingChange('maxSpeed', value)}
                    min={50}
                    max={300}
                    step={10}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Time Interval */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Min Time Interval</label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((settings.minTimeInterval || 30000) / 1000)}s
                  </span>
                </div>
                <Slider
                  value={[(settings.minTimeInterval || 30000) / 1000]}
                  onValueChange={([value]) => handleSettingChange('minTimeInterval', value * 1000)}
                  min={5}
                  max={300}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Accuracy */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Min Accuracy</label>
                  <span className="text-sm text-muted-foreground">{settings.minAccuracy}m</span>
                </div>
                <Slider
                  value={[settings.minAccuracy || 100]}
                  onValueChange={([value]) => handleSettingChange('minAccuracy', value)}
                  min={10}
                  max={500}
                  step={10}
                  className="w-full"
                />
              </div>

              {/* Toggle Switches */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Time Filter</span>
                  </div>
                  <Switch
                    checked={settings.enableTimeFilter}
                    onCheckedChange={(checked) => handleSettingChange('enableTimeFilter', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Gauge className="w-4 h-4" />
                    <span className="text-sm font-medium">Speed Filter</span>
                  </div>
                  <Switch
                    checked={settings.enableSpeedFilter}
                    onCheckedChange={(checked) => handleSettingChange('enableSpeedFilter', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">Accuracy Filter</span>
                  </div>
                  <Switch
                    checked={settings.enableAccuracyFilter}
                    onCheckedChange={(checked) => handleSettingChange('enableAccuracyFilter', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-medium">Preserve Stops</span>
                  </div>
                  <Switch
                    checked={settings.preserveStops}
                    onCheckedChange={(checked) => handleSettingChange('preserveStops', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-sm font-medium">Preserve Speed Changes</span>
                  </div>
                  <Switch
                    checked={settings.preserveSpeedChanges}
                    onCheckedChange={(checked) => handleSettingChange('preserveSpeedChanges', checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetSettings}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetPerformance}
                className="flex-1"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Clear Stats
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};



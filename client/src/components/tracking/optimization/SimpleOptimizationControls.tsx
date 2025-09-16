import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Zap, 
  TrendingDown, 
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { useCoordinateOptimization } from '@/hooks/use-coordinate-optimization';
import { OptimizationResult } from '@/types/optimization';

interface SimpleOptimizationControlsProps {
  onOptimize?: (positions: any[], result: OptimizationResult) => void;
  className?: string;
}

export const SimpleOptimizationControls: React.FC<SimpleOptimizationControlsProps> = ({
  onOptimize,
  className = ''
}) => {
  const {
    settings,
    updateSettings,
    resetSettings,
    performanceData,
    resetPerformance,
    presets,
    applyPreset
  } = useCoordinateOptimization();

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  return (
    <Card className={`w-full max-w-sm shadow-professional-lg border-primary/20 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center">
            <Settings className="w-4 h-4 mr-1 text-primary" />
            Optimization
          </div>
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
            {performanceData.totalOptimizations}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3 p-3">
        {/* Performance Summary */}
        {performanceData.totalOptimizations > 0 && (
          <div className="bg-muted/50 rounded p-2">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-primary">
                  {formatPercentage(performanceData.averageReduction)}
                </div>
                <div className="text-xs text-muted-foreground">Avg Reduction</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {performanceData.totalBandwidthSaved.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Total Saved</div>
              </div>
            </div>
          </div>
        )}

        {/* Preset Buttons */}
        <div className="space-y-1">
          <div className="text-xs font-medium">Presets:</div>
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset('conservative')}
              className="flex-1 h-6 text-xs"
            >
              Conservative
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset('balanced')}
              className="flex-1 h-6 text-xs"
            >
              Balanced
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset('aggressive')}
              className="flex-1 h-6 text-xs"
            >
              Aggressive
            </Button>
          </div>
        </div>

        {/* Tolerance Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Tolerance</label>
            <span className="text-xs text-muted-foreground">{settings.tolerance}m</span>
          </div>
          <Slider
            value={[settings.tolerance]}
            onValueChange={([value]) => updateSettings({ tolerance: value })}
            min={1}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Speed Settings */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Min Speed</label>
              <span className="text-xs text-muted-foreground">{settings.minSpeed} km/h</span>
            </div>
            <Slider
              value={[settings.minSpeed]}
              onValueChange={([value]) => updateSettings({ minSpeed: value })}
              min={0}
              max={50}
              step={1}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium">Max Speed</label>
              <span className="text-xs text-muted-foreground">{settings.maxSpeed} km/h</span>
            </div>
            <Slider
              value={[settings.maxSpeed]}
              onValueChange={([value]) => updateSettings({ maxSpeed: value })}
              min={50}
              max={300}
              step={10}
              className="w-full"
            />
          </div>
        </div>

        {/* Time Interval */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Min Time Interval</label>
            <span className="text-xs text-muted-foreground">
              {Math.round(settings.minTimeInterval / 1000)}s
            </span>
          </div>
          <Slider
            value={[settings.minTimeInterval / 1000]}
            onValueChange={([value]) => updateSettings({ minTimeInterval: value * 1000 })}
            min={5}
            max={300}
            step={5}
            className="w-full"
          />
        </div>

        {/* Toggle Switches */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <TrendingDown className="w-3 h-3" />
              <span className="text-xs font-medium">Preserve Stops</span>
            </div>
            <Switch
              checked={settings.preserveStops}
              onCheckedChange={(checked) => updateSettings({ preserveStops: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <Zap className="w-3 h-3" />
              <span className="text-xs font-medium">Preserve Speed Changes</span>
            </div>
            <Switch
              checked={settings.preserveSpeedChanges}
              onCheckedChange={(checked) => updateSettings({ preserveSpeedChanges: checked })}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={resetSettings}
            className="flex-1 h-6 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetPerformance}
            className="flex-1 h-6 text-xs"
          >
            <BarChart3 className="w-3 h-3 mr-1" />
            Clear Stats
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

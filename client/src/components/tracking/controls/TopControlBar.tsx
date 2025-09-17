import React from 'react';
import { ModeToggle } from './ModeToggle';
import { DeviceSelector } from './DeviceSelector';
import { DateRangePicker } from './replay/DateRangePicker';
import { Clock, MapPin } from 'lucide-react';
import { TrackingMode } from '@/contexts/TrackingModeContext';
import { Device } from '@/components/tracking/map/types';

interface TopControlBarProps {
  mode: TrackingMode;
  onModeChange: (mode: TrackingMode) => void;
  devices: Device[];
  selectedDeviceId: number | null;
  onDeviceSelect: (deviceId: number | null) => void;
  replayData: {
    dateRange: {
      from: Date;
      to: Date;
    };
  };
  onDateRangeChange: (from: Date, to: Date) => void;
  isLoading: boolean;
}

export const TopControlBar: React.FC<TopControlBarProps> = ({
  mode,
  onModeChange,
  devices,
  selectedDeviceId,
  onDeviceSelect,
  replayData,
  onDateRangeChange,
  isLoading
}) => {
  return (
    <div className="bg-card border-b border-border p-2 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mode Toggle */}
          <ModeToggle 
            mode={mode} 
            onModeChange={onModeChange}
          />
          
          {/* Device Selector */}
          <DeviceSelector
            devices={devices}
            selectedDeviceId={selectedDeviceId || undefined}
            onDeviceSelect={(deviceId) => onDeviceSelect(deviceId || null)}
          />
          
          {/* Date Range Picker - Only in replay mode */}
          {mode === 'replay' && (
            <DateRangePicker
              fromDate={replayData.dateRange.from}
              toDate={replayData.dateRange.to}
              onDateChange={onDateRangeChange}
              isLoading={isLoading}
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
  );
};

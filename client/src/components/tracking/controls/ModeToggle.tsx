import React from 'react';
import { Play, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrackingMode } from '@/contexts/TrackingModeContext';

interface ModeToggleProps {
  mode: TrackingMode;
  onModeChange: (mode: TrackingMode) => void;
  className?: string;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
  mode,
  onModeChange,
  className = ''
}) => {
  console.log('🔄 ModeToggle: Current mode:', mode);
  
  return (
    <div className={`flex items-center space-x-1 bg-muted rounded-lg p-1 ${className}`}>
      <Button
        variant={mode === 'live' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('live')}
        className={`flex items-center space-x-2 ${
          mode === 'live' 
            ? 'bg-primary text-primary-foreground shadow-sm' 
            : 'hover:bg-muted-foreground/10'
        }`}
      >
        <MapPin className="w-4 h-4" />
        <span className="text-sm font-medium">Live</span>
      </Button>
      
      <Button
        variant={mode === 'replay' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onModeChange('replay')}
        className={`flex items-center space-x-2 ${
          mode === 'replay' 
            ? 'bg-primary text-primary-foreground shadow-sm' 
            : 'hover:bg-muted-foreground/10'
        }`}
      >
        <Clock className="w-4 h-4" />
        <span className="text-sm font-medium">Replay</span>
      </Button>
    </div>
  );
};

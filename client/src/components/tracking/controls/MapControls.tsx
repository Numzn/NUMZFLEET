import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { TraccarDevice } from '@shared/schema';

interface MapControlsProps {
  selectedDevice?: TraccarDevice;
  onFullscreen: () => void;
  onOpenExternal: () => void;
  isFullscreen: boolean;
  className?: string;
}

export const MapControls = ({
  selectedDevice,
  onFullscreen,
  onOpenExternal,
  isFullscreen,
  className = '',
}: MapControlsProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Device Status */}
      {selectedDevice && (
        <Badge 
          variant={selectedDevice.status === 'online' ? 'default' : 'secondary'}
          className="text-xs"
        >
          {selectedDevice.status}
        </Badge>
      )}

      {/* Control Buttons - Refresh button removed for silent operation */}
      
      <Button
        variant="outline"
        size="sm"
        onClick={onFullscreen}
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenExternal}
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  );
};

export interface Device {
  id: number;
  name: string;
  status: string;
  lastUpdate: string;
  uniqueId: string;
  position?: {
    latitude: number;
    longitude: number;
  };
}

export interface TrackingMapProps {
  className?: string;
  height?: string;
}


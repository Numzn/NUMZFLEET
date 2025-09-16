export interface Device {
  id: number;
  name: string;
  status: string;
  lastUpdate: string;
  uniqueId: string;
  position?: {
    latitude: number;
    longitude: number;
    speed?: number;
    course?: number;
    address?: string;
    accuracy?: number | null;
    accuracyScore?: number;
    lastUpdate?: string;
  };
}

export interface TrackingMapProps {
  className?: string;
  height?: string;
  selectedDevice?: Device;
  onDeviceSelect?: (device: Device | undefined) => void;
}


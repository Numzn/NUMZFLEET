import DirectionsCarFilledIcon from '@mui/icons-material/DirectionsCarFilled';
import LinkIcon from '@mui/icons-material/Link';
import PersonIcon from '@mui/icons-material/Person';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import FenceIcon from '@mui/icons-material/Fence';
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

/** Setup module keys — stable anchors and readiness ids. */
export const SETUP_MODULE_IDS = {
  identity: 'identity',
  device: 'device',
  driver: 'driver',
  fuel: 'fuel',
  geofence: 'geofence',
  safety: 'safety',
  alerts: 'alerts',
};

export const SETUP_MODULES = [
  {
    id: SETUP_MODULE_IDS.identity,
    title: 'Vehicle Identity',
    subtitle: 'How this vehicle is identified in fleet operations',
    icon: DirectionsCarFilledIcon,
    optional: false,
  },
  {
    id: SETUP_MODULE_IDS.device,
    title: 'Device & Telemetry',
    subtitle: 'Link the tracker and tracking preferences',
    icon: LinkIcon,
    optional: false,
  },
  {
    id: SETUP_MODULE_IDS.driver,
    title: 'Driver Assignment',
    subtitle: 'Assign who operates this vehicle',
    icon: PersonIcon,
    optional: false,
  },
  {
    id: SETUP_MODULE_IDS.fuel,
    title: 'Fuel Setup',
    subtitle: 'Enable fuel planning and low-fuel insights',
    icon: LocalGasStationIcon,
    optional: false,
  },
  {
    id: SETUP_MODULE_IDS.geofence,
    title: 'Zone monitoring',
    subtitle: 'Operational preferences for linked zones',
    icon: FenceIcon,
    optional: true,
  },
  {
    id: SETUP_MODULE_IDS.safety,
    title: 'Safety & Immobilization',
    subtitle: 'Remote immobilization when supported',
    icon: SecurityIcon,
    optional: true,
  },
  {
    id: SETUP_MODULE_IDS.alerts,
    title: 'Alerts & Monitoring',
    subtitle: 'Which events to surface for this vehicle',
    icon: NotificationsActiveIcon,
    optional: true,
  },
];

export function setupModuleAnchorId(moduleId) {
  return `setup-module-${moduleId}`;
}

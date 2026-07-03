import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';

export const VEHICLE_WORKSPACE_TAB_IDS = {
  overview: 'overview',
  maintenance: 'maintenance',
  repairs: 'repairs',
  documents: 'documents',
  fuel: 'fuel',
};

/** Legacy URL params — redirect removed or renamed tabs. */
const LEGACY_TAB_ALIASES = {
  performance: VEHICLE_WORKSPACE_TAB_IDS.fuel,
  alerts: VEHICLE_WORKSPACE_TAB_IDS.overview,
};

export const DEFAULT_VEHICLE_WORKSPACE_TAB = VEHICLE_WORKSPACE_TAB_IDS.overview;

/** Desktop + URL-synced tabs. */
export const VEHICLE_WORKSPACE_TABS = [
  { id: VEHICLE_WORKSPACE_TAB_IDS.overview, label: 'Overview', icon: DashboardOutlinedIcon },
  { id: VEHICLE_WORKSPACE_TAB_IDS.maintenance, label: 'Maintenance', icon: BuildOutlinedIcon },
  { id: VEHICLE_WORKSPACE_TAB_IDS.repairs, label: 'Repairs & Breakdown', icon: HandymanOutlinedIcon },
  { id: VEHICLE_WORKSPACE_TAB_IDS.documents, label: 'Documents', icon: FolderOutlinedIcon },
  { id: VEHICLE_WORKSPACE_TAB_IDS.fuel, label: 'Fuel', icon: LocalGasStationOutlinedIcon },
];

/** Mobile bottom nav: primary tabs + More sheet for repairs/documents/setup. */
export const MOBILE_PRIMARY_TAB_IDS = [
  VEHICLE_WORKSPACE_TAB_IDS.overview,
  VEHICLE_WORKSPACE_TAB_IDS.maintenance,
  VEHICLE_WORKSPACE_TAB_IDS.fuel,
];

export function isValidVehicleWorkspaceTab(tabId) {
  return VEHICLE_WORKSPACE_TABS.some((t) => t.id === tabId);
}

export function resolveVehicleWorkspaceTab(tabId) {
  const normalized = LEGACY_TAB_ALIASES[tabId] ?? tabId;
  if (isValidVehicleWorkspaceTab(normalized)) return normalized;
  return DEFAULT_VEHICLE_WORKSPACE_TAB;
}

export function computeMaintenanceBadge({ dueSoonCount = 0 }) {
  const total = dueSoonCount || 0;
  return total > 0 ? total : null;
}

export function computeRepairsBadge({ openServiceCount = 0 }) {
  const total = openServiceCount || 0;
  return total > 0 ? total : null;
}

export function getTabBadge(tabId, { dueSoonCount, openServiceCount }) {
  if (tabId === VEHICLE_WORKSPACE_TAB_IDS.maintenance) {
    return computeMaintenanceBadge({ dueSoonCount });
  }
  if (tabId === VEHICLE_WORKSPACE_TAB_IDS.repairs) {
    return computeRepairsBadge({ openServiceCount });
  }
  return null;
}

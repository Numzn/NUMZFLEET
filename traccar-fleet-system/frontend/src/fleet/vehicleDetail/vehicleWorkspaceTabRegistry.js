import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';

export const VEHICLE_WORKSPACE_TAB_IDS = {
  overview: 'overview',
  maintenance: 'maintenance',
  repairs: 'repairs',
  documents: 'documents',
  alerts: 'alerts',
  performance: 'performance',
};

export const DEFAULT_VEHICLE_WORKSPACE_TAB = VEHICLE_WORKSPACE_TAB_IDS.overview;

/** Desktop + URL-synced tabs (all six). */
export const VEHICLE_WORKSPACE_TABS = [
  { id: VEHICLE_WORKSPACE_TAB_IDS.overview, label: 'Overview', icon: DashboardOutlinedIcon },
  { id: VEHICLE_WORKSPACE_TAB_IDS.maintenance, label: 'Maintenance', icon: BuildOutlinedIcon },
  { id: VEHICLE_WORKSPACE_TAB_IDS.repairs, label: 'Repairs & Breakdown', icon: HandymanOutlinedIcon },
  { id: VEHICLE_WORKSPACE_TAB_IDS.documents, label: 'Documents', icon: FolderOutlinedIcon },
  { id: VEHICLE_WORKSPACE_TAB_IDS.alerts, label: 'Alerts', icon: NotificationsOutlinedIcon },
  { id: VEHICLE_WORKSPACE_TAB_IDS.performance, label: 'Performance', icon: SpeedOutlinedIcon },
];

/** Mobile bottom nav: 4 primary + More sheet for repairs/documents/setup. */
export const MOBILE_PRIMARY_TAB_IDS = [
  VEHICLE_WORKSPACE_TAB_IDS.overview,
  VEHICLE_WORKSPACE_TAB_IDS.maintenance,
  VEHICLE_WORKSPACE_TAB_IDS.alerts,
  VEHICLE_WORKSPACE_TAB_IDS.performance,
];

export function isValidVehicleWorkspaceTab(tabId) {
  return VEHICLE_WORKSPACE_TABS.some((t) => t.id === tabId);
}

export function resolveVehicleWorkspaceTab(tabId) {
  if (isValidVehicleWorkspaceTab(tabId)) return tabId;
  return DEFAULT_VEHICLE_WORKSPACE_TAB;
}

export function computeMaintenanceBadge({ dueSoonCount = 0, openServiceCount = 0 }) {
  const total = (dueSoonCount || 0) + (openServiceCount || 0);
  return total > 0 ? total : null;
}

export function computeAlertsBadge(alerts = []) {
  const count = alerts?.length ?? 0;
  if (count <= 0) return null;
  return count > 99 ? '99+' : count;
}

export function getTabBadge(tabId, { dueSoonCount, openServiceCount, alerts }) {
  if (tabId === VEHICLE_WORKSPACE_TAB_IDS.maintenance) {
    return computeMaintenanceBadge({ dueSoonCount, openServiceCount });
  }
  if (tabId === VEHICLE_WORKSPACE_TAB_IDS.alerts) {
    return computeAlertsBadge(alerts);
  }
  return null;
}

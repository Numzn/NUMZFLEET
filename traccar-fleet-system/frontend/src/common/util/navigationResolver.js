/**
 * Navigation Resolver
 *
 * Returns the appropriate navigation structure based on the current organization context.
 * This is the single source of truth for navigation across all user types.
 *
 * Design:
 * - One navigation system with context-aware behavior
 * - Reuses existing navigation definitions where possible
 * - No duplicate navigation structures
 */

import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import BusinessIcon from '@mui/icons-material/Business';
import GroupsIcon from '@mui/icons-material/Groups';

/**
 * Get navigation for PLATFORM context (system administrator)
 * Focuses on organization management, not fleet operations
 */
export function getPlatformNavigation(badges = {}) {
  return [
    {
      key: 'platform-primary',
      items: [
        {
          title: 'Overview',
          path: '/saas/platform/overview',
          icon: AnalyticsIcon,
        },
      ],
    },
    {
      key: 'platform-management',
      label: 'MANAGEMENT',
      items: [
        {
          title: 'Partners',
          path: '/saas/platform/partners',
          icon: BusinessIcon,
        },
        {
          title: 'Direct Customers',
          path: '/saas/platform/direct-customers',
          icon: GroupsIcon,
        },
      ],
    },
    {
      key: 'platform-system',
      label: 'SYSTEM',
      items: [
        {
          title: 'Settings',
          path: '/settings',
          icon: SettingsOutlinedIcon,
        },
      ],
    },
  ];
}

/**
 * Get navigation for PARTNER context (reseller/franchise admin)
 * Focuses on managing own customer organizations
 */
export function getPartnerNavigation(badges = {}) {
  return [
    {
      key: 'partner-primary',
      items: [
        {
          title: 'Customers',
          path: '/saas/partner/customers',
          icon: GroupsIcon,
        },
      ],
    },
    {
      key: 'partner-system',
      label: 'SYSTEM',
      items: [
        {
          title: 'Settings',
          path: '/settings',
          icon: SettingsOutlinedIcon,
        },
      ],
    },
  ];
}

/**
 * Get navigation for CUSTOMER context (end-user fleet operator)
 * Focuses on fleet operations (vehicles, fuel, maintenance, reports)
 * This is the existing UnifiedSidebar navigation structure
 */
export function getCustomerNavigation({
  alertsBadgeCount = 0,
  pendingFuelCount = 0,
  maintenanceBadge = 0,
  manager = false,
  admin = false,
  readonly = false,
  features = {},
  readonly: isReadonly = false,
} = {}) {
  return [
    {
      key: 'primary',
      items: [
        { title: 'Dashboard', path: '/', icon: DashboardOutlinedIcon },
        {
          title: 'Live Map',
          path: '/map',
          icon: MapOutlinedIcon,
          badge: alertsBadgeCount,
          badgeHint: 'Live activity — recent Traccar events in this session (not notification unread)',
        },
      ],
    },
    {
      key: 'operations',
      label: 'OPERATIONS',
      items: [
        {
          title: 'Vehicles',
          path: '/fleet/vehicles',
          icon: DirectionsCarOutlinedIcon,
          show: manager && !isReadonly,
        },
        {
          title: 'Drivers',
          path: '/fleet/drivers',
          icon: PersonOutlineOutlinedIcon,
          show: !features.disableDrivers && manager && !isReadonly,
        },
        {
          title: 'Geofences',
          path: '/geofences',
          icon: PlaceOutlinedIcon,
          show: admin && !isReadonly,
        },
        {
          title: 'Fueling Day',
          path: '/fleet/operation-sessions/prepare',
          icon: LocalGasStationOutlinedIcon,
          show: !isReadonly,
          activeMatch: (path) => path.startsWith('/fleet/operation-sessions'),
        },
        {
          title: 'Driver requests',
          path: '/fuel-requests',
          icon: AssignmentOutlinedIcon,
          show: features.enableFuelRequests && !isReadonly,
          badge: pendingFuelCount > 0 ? pendingFuelCount : undefined,
        },
        {
          title: 'Maintenance',
          path: '/maintenance',
          icon: BuildOutlinedIcon,
          show: manager && !isReadonly,
          badge: maintenanceBadge,
          activeMatch: (path) => path.startsWith('/maintenance'),
        },
      ].filter((i) => i.show !== false),
    },
    {
      key: 'reports',
      label: 'REPORTS',
      items: [
        { title: 'Fuel', path: '/reports/fuel-operations', icon: LocalGasStationOutlinedIcon, show: manager },
        { title: 'Analytics', path: '/reports/statistics', icon: InsightsOutlinedIcon, show: admin },
        { title: 'Activity', path: '/reports/summary', icon: BarChartOutlinedIcon, show: admin },
      ].filter((i) => i.show !== false),
    },
    {
      key: 'system',
      label: 'SYSTEM',
      items: [
        {
          title: 'Settings',
          path: '/settings',
          icon: SettingsOutlinedIcon,
        },
      ],
    },
  ];
}

/**
 * Main navigation resolver
 * Returns the appropriate navigation structure based on context type
 *
 * @param {Object} currentContext - Redux organizations.currentContext
 * @param {Object} options - Configuration options
 * @param {Array} options.externalSystemItems - External items to add to system section (billing, support)
 * @returns {Array} Navigation group structure
 */
export function resolveNavigation(currentContext, options = {}) {
  if (!currentContext || !currentContext.type) {
    // Fallback: return customer nav
    return getCustomerNavigation(options);
  }

  let navGroups;

  switch (currentContext.type) {
    case 'platform':
      navGroups = getPlatformNavigation(options.badges || {});
      break;
    case 'partner':
      navGroups = getPartnerNavigation(options.badges || {});
      break;
    case 'customer':
    default:
      navGroups = getCustomerNavigation(options);
      break;
  }

  // Supplement system section with external items (billing, support links)
  if (options.externalSystemItems && options.externalSystemItems.length > 0) {
    const systemGroupIndex = navGroups.findIndex((g) => g.key === 'system' || g.key.includes('system'));
    if (systemGroupIndex !== -1) {
      // Add external items to the system group
      navGroups[systemGroupIndex].items = [
        ...navGroups[systemGroupIndex].items,
        ...options.externalSystemItems,
      ];
    }
  }

  return navGroups;
}

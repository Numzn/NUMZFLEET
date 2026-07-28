import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';

/**
 * Single source of truth for the Settings Center's section nav — mirrors the
 * shape of fleet/vehicleDetail/vehicleWorkspaceTabRegistry.js (a registry array
 * instead of each nav surface hardcoding its own list), adapted for path-based
 * routing since each section here is a real route rather than one route with a
 * `?tab=` query param.
 *
 * `live: false` sections have no destination yet — they render disabled with a
 * "Soon" chip until their phase in .claude/plans/this-is-a-very-deep-stallman.md
 * ships, rather than 404ing or being silently invented ahead of schedule.
 */
export const SETTINGS_SECTION_IDS = {
  profile: 'profile',
  security: 'security',
  organization: 'organization',
  team: 'team',
  devices: 'devices',
  preferences: 'preferences',
  notifications: 'notifications',
};

export const SETTINGS_SECTIONS = [
  {
    id: SETTINGS_SECTION_IDS.profile,
    label: 'Profile',
    icon: PersonOutlineIcon,
    path: '/settings/profile',
    match: (pathname) => pathname.startsWith('/settings/profile'),
    live: true,
  },
  {
    id: SETTINGS_SECTION_IDS.security,
    label: 'Security',
    icon: LockOutlinedIcon,
    path: '/settings/security',
    match: (pathname) => pathname.startsWith('/settings/security'),
    live: true,
  },
  {
    id: SETTINGS_SECTION_IDS.organization,
    label: 'Organization',
    icon: BusinessOutlinedIcon,
    path: '/settings/organization',
    match: (pathname) => pathname.startsWith('/settings/organization'),
    live: true,
  },
  {
    id: SETTINGS_SECTION_IDS.team,
    label: 'Team',
    icon: PeopleOutlineIcon,
    path: '/settings/users',
    match: (pathname) => pathname.startsWith('/settings/users'),
    live: true,
    requiresRole: 'manager',
  },
  {
    id: SETTINGS_SECTION_IDS.devices,
    label: 'Devices',
    icon: BuildOutlinedIcon,
    path: '/settings/devices',
    match: (pathname) => pathname.startsWith('/settings/device'),
    live: true,
    requiresRole: 'technician',
  },
  {
    id: SETTINGS_SECTION_IDS.preferences,
    label: 'Preferences',
    icon: TuneOutlinedIcon,
    path: '/settings/preferences',
    match: (pathname) => pathname.startsWith('/settings/preferences'),
    live: true,
  },
  {
    id: SETTINGS_SECTION_IDS.notifications,
    label: 'Notifications',
    icon: NotificationsOutlinedIcon,
    // Deliberately NOT /settings/notifications — that's Traccar's existing
    // "Alert rules" list (settings/NotificationsPage.jsx), a different
    // concept (event->notificator rule config vs. personal channel prefs).
    // Reusing that path would recreate the exact class of naming collision
    // the app-wide UI/UX audit found elsewhere (Drivers, Maintenance).
    path: '/settings/notification-preferences',
    match: (pathname) => pathname.startsWith('/settings/notification-preferences'),
    live: true,
  },
];

export function resolveActiveSettingsSection(pathname) {
  return SETTINGS_SECTIONS.find((section) => section.live && section.match(pathname)) || null;
}

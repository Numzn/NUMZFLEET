import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import DomainAddOutlinedIcon from '@mui/icons-material/DomainAddOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';

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
 *
 * `category` is the frozen Configuration Hub information architecture
 * (Overview/Personal/Organization/Fleet/Automation/Integrations/System) —
 * see the Settings discovery-audit artifact for the evidence behind it.
 * `description`/`keywords` exist so settings content can be searched (e.g.
 * from CommandPalette) without a separate, hand-maintained search index.
 *
 * `requiresRole` filters coarsely ('manager' | 'admin' | 'technician'); note
 * useManager() already returns true for admins (admin implies manager in
 * this app's permission model — see permissions.js), so 'admin' only needs
 * to be used where a check is genuinely stricter than 'manager'.
 * `requiresFeature` names a key from useFeatures() — when present, the
 * section only shows if that flag is falsy (mirrors the `!features.disableX`
 * guards this migrated from in UnifiedSidebar.jsx).
 */
export const SETTINGS_CATEGORIES = {
  personal: 'Personal',
  organization: 'Organization',
  fleet: 'Fleet',
  automation: 'Automation',
  integrations: 'Integrations',
  system: 'System',
  platform: 'Platform',
};

export const SETTINGS_SECTION_IDS = {
  overview: 'overview',
  profile: 'profile',
  security: 'security',
  organization: 'organization',
  team: 'team',
  roles: 'roles',
  devices: 'devices',
  preferences: 'preferences',
  notifications: 'notifications',
  alertRules: 'alertRules',
  groups: 'groups',
  calendars: 'calendars',
  computedAttributes: 'computedAttributes',
  maintenanceSchedules: 'maintenanceSchedules',
  savedCommands: 'savedCommands',
  announcement: 'announcement',
  server: 'server',
  platformCompanies: 'platformCompanies',
};

export const SETTINGS_SECTIONS = [
  {
    id: SETTINGS_SECTION_IDS.overview,
    label: 'Overview',
    icon: DashboardOutlinedIcon,
    path: '/settings',
    // Exact match only — every other section's own match() would otherwise
    // never fire if this one used startsWith('/settings').
    match: (pathname) => pathname === '/settings',
    live: true,
    category: null,
    description: 'Configuration health, recent changes, and quick access.',
    keywords: ['overview', 'home', 'dashboard'],
  },
  {
    id: SETTINGS_SECTION_IDS.profile,
    label: 'Profile',
    icon: PersonOutlineIcon,
    path: '/settings/profile',
    match: (pathname) => pathname.startsWith('/settings/profile'),
    live: true,
    category: 'personal',
    description: 'Your name, email, phone, and avatar.',
    keywords: ['name', 'email', 'phone', 'avatar', 'photo', 'account'],
  },
  {
    id: SETTINGS_SECTION_IDS.security,
    label: 'Security',
    icon: LockOutlinedIcon,
    path: '/settings/security',
    match: (pathname) => pathname.startsWith('/settings/security'),
    live: true,
    category: 'personal',
    description: 'Password, two-factor authentication, and login history.',
    keywords: ['password', 'totp', '2fa', 'two-factor', 'login history', 'security'],
  },
  {
    id: SETTINGS_SECTION_IDS.organization,
    label: 'Organization',
    icon: BusinessOutlinedIcon,
    path: '/settings/organization',
    match: (pathname) => pathname.startsWith('/settings/organization'),
    live: true,
    category: 'organization',
    description: 'Company name, member counts, and your role.',
    keywords: ['company', 'organization', 'org', 'name', 'branding'],
  },
  {
    id: SETTINGS_SECTION_IDS.team,
    label: 'Team',
    icon: PeopleOutlineIcon,
    path: '/settings/users',
    match: (pathname) => pathname.startsWith('/settings/users'),
    live: true,
    requiresRole: 'manager',
    category: 'organization',
    description: 'Manage who has access to your fleet.',
    keywords: ['users', 'team', 'members', 'access', 'invite'],
  },
  {
    id: SETTINGS_SECTION_IDS.roles,
    label: 'Roles',
    icon: AssignmentIndOutlinedIcon,
    path: '/settings/roles',
    match: (pathname) => pathname.startsWith('/settings/roles'),
    live: true,
    requiresRole: 'manager',
    category: 'organization',
    description: 'What each role can and cannot do.',
    keywords: ['roles', 'permissions', 'access', 'rbac'],
  },
  {
    id: SETTINGS_SECTION_IDS.devices,
    label: 'Devices',
    icon: BuildOutlinedIcon,
    path: '/settings/devices',
    match: (pathname) => pathname.startsWith('/settings/device'),
    live: true,
    requiresRole: 'technician',
    category: 'integrations',
    description: 'GPS trackers linked to your fleet.',
    keywords: ['gps', 'devices', 'trackers', 'hardware', 'connectivity'],
  },
  {
    id: SETTINGS_SECTION_IDS.preferences,
    label: 'Preferences',
    icon: TuneOutlinedIcon,
    path: '/settings/preferences',
    match: (pathname) => pathname.startsWith('/settings/preferences'),
    live: true,
    category: 'personal',
    description: 'Units, theme, language, and default map.',
    keywords: ['theme', 'dark mode', 'light mode', 'language', 'units', 'map', 'preferences'],
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
    category: 'personal',
    description: 'Choose which events notify you, and how.',
    keywords: ['notifications', 'alerts', 'sms', 'email', 'push', 'channels'],
  },
  {
    id: SETTINGS_SECTION_IDS.alertRules,
    label: 'Alert Rules',
    icon: NotificationsActiveOutlinedIcon,
    path: '/settings/notifications',
    // Exact/subsegment match only — must NOT swallow /settings/notification-preferences
    // (see the Notifications section above and the discovery audit's note on
    // this exact class of naming collision).
    match: (pathname) => pathname === '/settings/notifications'
      || pathname === '/settings/notification'
      || pathname.startsWith('/settings/notification/'),
    live: true,
    category: 'automation',
    description: 'Which Traccar events trigger which notificators.',
    keywords: ['alert rules', 'notificators', 'events', 'automation'],
  },
  {
    id: SETTINGS_SECTION_IDS.groups,
    label: 'Groups',
    icon: FolderOutlinedIcon,
    path: '/settings/groups',
    match: (pathname) => pathname.startsWith('/settings/group'),
    live: true,
    requiresFeature: 'disableGroups',
    category: 'integrations',
    description: 'Device grouping for permission inheritance.',
    keywords: ['groups', 'device groups', 'connectivity'],
  },
  {
    id: SETTINGS_SECTION_IDS.calendars,
    label: 'Calendars',
    icon: TodayOutlinedIcon,
    path: '/settings/calendars',
    match: (pathname) => pathname.startsWith('/settings/calendar'),
    live: true,
    requiresFeature: 'disableCalendars',
    category: 'automation',
    description: 'Time windows feeding rules and reports.',
    keywords: ['calendars', 'schedule', 'time window'],
  },
  {
    id: SETTINGS_SECTION_IDS.computedAttributes,
    label: 'Computed Attributes',
    icon: CalculateOutlinedIcon,
    path: '/settings/attributes',
    match: (pathname) => pathname.startsWith('/settings/attribute'),
    live: true,
    // Note: UnifiedSidebar's legacy guard checked `features.disableComputedAttributes`,
    // a key useFeatures() never actually returns (it exposes `disableAttributes`) —
    // that guard was already inert before this migration. Preserving the real
    // current behavior (always visible to managers) rather than silently
    // starting to enforce a gate nobody has been able to trip until now.
    category: 'automation',
    description: 'Derived values feeding automation rules.',
    keywords: ['computed attributes', 'derived values', 'automation'],
  },
  {
    id: SETTINGS_SECTION_IDS.maintenanceSchedules,
    label: 'Maintenance Schedules',
    icon: ScheduleOutlinedIcon,
    path: '/settings/maintenances',
    match: (pathname) => pathname.startsWith('/settings/maintenance'),
    live: true,
    requiresRole: 'admin',
    requiresFeature: 'disableMaintenance',
    category: 'fleet',
    description: 'Traccar-native maintenance rule templates (advanced).',
    keywords: ['maintenance schedules', 'traccar schedules', 'service intervals'],
  },
  {
    id: SETTINGS_SECTION_IDS.savedCommands,
    label: 'Saved Commands',
    icon: SendOutlinedIcon,
    path: '/settings/commands',
    match: (pathname) => pathname.startsWith('/settings/command'),
    live: true,
    requiresFeature: 'disableSavedCommands',
    category: 'automation',
    description: 'Reusable device command presets.',
    keywords: ['saved commands', 'device commands'],
  },
  {
    id: SETTINGS_SECTION_IDS.announcement,
    label: 'Announcement',
    icon: CampaignOutlinedIcon,
    path: '/settings/announcement',
    match: (pathname) => pathname.startsWith('/settings/announcement'),
    live: true,
    requiresRole: 'manager',
    category: 'system',
    description: 'Broadcast a banner to every user.',
    keywords: ['announcement', 'broadcast', 'banner'],
  },
  {
    id: SETTINGS_SECTION_IDS.server,
    label: 'Server',
    icon: DnsOutlinedIcon,
    path: '/settings/server',
    match: (pathname) => pathname.startsWith('/settings/server'),
    live: true,
    requiresRole: 'admin',
    category: 'system',
    description: 'Raw Traccar server configuration.',
    keywords: ['server', 'traccar server', 'defaults'],
  },
  {
    id: SETTINGS_SECTION_IDS.platformCompanies,
    label: 'Companies',
    icon: DomainAddOutlinedIcon,
    path: '/settings/platform/companies',
    match: (pathname) => pathname.startsWith('/settings/platform/companies'),
    live: true,
    requiresRole: 'platformOwner',
    category: 'platform',
    description: 'Create and manage tenant companies.',
    keywords: ['platform', 'companies', 'tenants', 'onboarding', 'provision'],
  },
];

export function resolveActiveSettingsSection(pathname) {
  return SETTINGS_SECTIONS.find((section) => section.live && section.match(pathname)) || null;
}

/**
 * Single gating rule for a section's requiresRole/requiresFeature, shared by
 * every consumer (SettingsSubNav, CommandPalette, ...) so a new section only
 * has to declare its gate once instead of every place that lists sections
 * re-implementing the same three-role/one-feature check.
 */
export function isSettingsSectionVisible(section, {
  manager, admin, technician, platformOwner, features,
} = {}) {
  if (section.requiresRole === 'manager' && !manager) return false;
  if (section.requiresRole === 'admin' && !admin) return false;
  if (section.requiresRole === 'technician' && !technician) return false;
  // Real enforcement is server-side (requirePlatformOwner in authGates.js,
  // which checks req.auth.isSuperAdmin — company_id IS NULL). useSuperAdmin()
  // is a looser frontend proxy for this (documented gap in
  // docs/PLATFORM_ARCHITECTURE.md, not resolved until its Phase 5 frontend
  // context store) — good enough to decide whether to show the nav entry,
  // not what actually gates the API.
  if (section.requiresRole === 'platformOwner' && !platformOwner) return false;
  if (section.requiresFeature && features?.[section.requiresFeature]) return false;
  return true;
}

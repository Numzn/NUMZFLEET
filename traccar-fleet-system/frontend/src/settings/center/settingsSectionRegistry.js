import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import { isPartnerAdminArea, isPlatformArea } from '../../common/util/navWorkspace.js';

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
 * `category` is the Configuration Hub information architecture
 * (Overview/Personal/Organization/Integrations/System, plus Platform and
 * Business for those capabilities). Every section here is a NUMZFLEET concept:
 * generic Traccar administration (maintenance schedules, alert rules, groups,
 * saved commands) was removed from the product surface — Traccar is an internal
 * integration, not something a fleet manager configures. What remains under
 * System for the platform owner (calendars, computed attributes, server) is
 * engineering tooling and is gated to that role, here and at the route.
 * `description`/`keywords` exist so settings content can be searched (e.g.
 * from CommandPalette) without a separate, hand-maintained search index.
 *
 * `requiresRole` filters coarsely ('manager' | 'admin' | 'technician' |
 * 'platformOwner'); note
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
  integrations: 'Integrations',
  system: 'System',
  platform: 'Platform',
  business: 'Business',
};

export const SETTINGS_SECTION_IDS = {
  overview: 'overview',
  profile: 'profile',
  security: 'security',
  platformAccess: 'platformAccess',
  businessAccess: 'businessAccess',
  people: 'people',
  roles: 'roles',
  devices: 'devices',
  preferences: 'preferences',
  notifications: 'notifications',
  calendars: 'calendars',
  computedAttributes: 'computedAttributes',
  announcement: 'announcement',
  server: 'server',
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
    id: SETTINGS_SECTION_IDS.platformAccess,
    label: 'Platform',
    icon: BusinessOutlinedIcon,
    // A plain link, not a context switch — Platform is a management
    // capability of this identity (isSuperAdmin), never a second
    // organization the session operates inside. See
    // fuel-api/src/services/tenantResolverService.js.
    path: '/saas/platform/overview',
    match: isPlatformArea,
    live: true,
    requiresRole: 'platformOwner',
    category: 'platform',
    description: 'Manage partners, direct customers, and platform-wide settings.',
    keywords: ['platform', 'partners', 'direct customers', 'tenants'],
  },
  {
    id: SETTINGS_SECTION_IDS.businessAccess,
    label: 'Business',
    icon: StorefrontOutlinedIcon,
    path: '/saas/partner/overview',
    match: isPartnerAdminArea,
    live: true,
    // Not a role — the active context's own organizationType, which for a
    // partner identity is always their own home company (no context switch
    // exists to make it otherwise). See navigationResolver.js
    // (`inPartnerAdmin`) for why /saas/partner/* shows Overview/Customers
    // here instead of the fleet nav.
    requiresContextType: 'partner',
    category: 'business',
    description: 'Manage the customers under your reseller business.',
    keywords: ['business', 'partner', 'reseller', 'customers'],
  },
  {
    id: SETTINGS_SECTION_IDS.people,
    label: 'People',
    icon: PeopleOutlineIcon,
    path: '/settings/people',
    match: (pathname) => pathname.startsWith('/settings/people'),
    live: true,
    requiresRole: 'manager',
    category: 'organization',
    description: 'Everyone in your fleet — roles, status, and driver profiles.',
    // 'users'/'team' stay so search still finds this by its former name.
    keywords: ['people', 'person', 'staff', 'drivers', 'users', 'team', 'members', 'access', 'invite'],
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
    // NUMZFLEET's business notification preferences. The path keeps its
    // historical name: Traccar's own event-to-notificator "alert rules" page is no
    // longer part of the product, and /settings/notifications is not a route.
    path: '/settings/notification-preferences',
    match: (pathname) => pathname.startsWith('/settings/notification-preferences'),
    live: true,
    category: 'personal',
    description: 'Choose which events notify you, and how.',
    keywords: ['notifications', 'alerts', 'sms', 'email', 'push', 'channels'],
  },
  {
    id: SETTINGS_SECTION_IDS.calendars,
    label: 'Calendars',
    icon: TodayOutlinedIcon,
    path: '/settings/calendars',
    match: (pathname) => pathname.startsWith('/settings/calendar'),
    live: true,
    // Engineering tool, not a fleet-management feature. It stays (platform owner
    // only) because scheduled reports still require a calendar to be selected;
    // no NUMZFLEET business feature configures calendars.
    requiresRole: 'platformOwner',
    category: 'system',
    description: 'Time windows used by scheduled reports (platform owner).',
    keywords: ['calendars', 'schedule', 'time window'],
  },
  {
    id: SETTINGS_SECTION_IDS.computedAttributes,
    label: 'Computed Attributes',
    icon: CalculateOutlinedIcon,
    path: '/settings/attributes',
    match: (pathname) => pathname.startsWith('/settings/attribute'),
    live: true,
    // Per-position scripting engine with no NUMZFLEET dependency. Kept as an
    // engineering capability for the platform owner only.
    requiresRole: 'platformOwner',
    category: 'system',
    description: 'Derived tracker values (platform owner).',
    keywords: ['computed attributes', 'derived values', 'engineering'],
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
    // Shared by every company, so it is a platform-owner decision — never a
    // per-company admin's.
    requiresRole: 'platformOwner',
    category: 'system',
    description: 'Platform-wide server configuration (platform owner).',
    keywords: ['server', 'defaults', 'platform'],
  },
];

export function resolveActiveSettingsSection(pathname) {
  return SETTINGS_SECTIONS.find((section) => section.live && section.match(pathname)) || null;
}

/**
 * Single gating rule for a section's requiresRole/requiresFeature, shared by
 * every consumer (the app sidebar, CommandPalette, ...) so a new section only
 * has to declare its gate once instead of every place that lists sections
 * re-implementing the same three-role/one-feature check.
 */
export function isSettingsSectionVisible(section, {
  manager, admin, technician, platformOwner, features, currentContextType,
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
  // Real enforcement is server-side too (GET/POST /api/partner/* require
  // req.auth.activeContext.type === 'partner'). currentContextType is the
  // same Redux value the primary sidebar already renders from — showing and
  // enforcing agree by construction, there's no separate guess here.
  if (section.requiresContextType && section.requiresContextType !== currentContextType) return false;
  if (section.requiresFeature && features?.[section.requiresFeature]) return false;
  return true;
}

/**
 * The Settings workspace's navigation, grouped and gated — consumed by the one
 * app sidebar when the user is in Settings, so that entering Settings swaps the
 * sidebar's contents rather than opening a second rail beside it.
 *
 * Overview has `category: null`; it is pinned above the categories rather than
 * being one of them, so it comes back as its own unlabelled group. Groups follow
 * SETTINGS_CATEGORIES' declared order, not the registry array's insertion order,
 * so a category keeps its place no matter which order sections were added.
 */
export function buildSettingsNavGroups(gates = {}) {
  const visible = SETTINGS_SECTIONS.filter((section) => isSettingsSectionVisible(section, gates));
  const pinned = visible.filter((section) => !section.category);

  const groups = Object.keys(SETTINGS_CATEGORIES)
    .map((key) => ({
      key,
      label: SETTINGS_CATEGORIES[key],
      sections: visible.filter((section) => section.category === key),
    }))
    .filter((group) => group.sections.length > 0);

  return pinned.length > 0
    ? [{ key: 'pinned', label: null, sections: pinned }, ...groups]
    : groups;
}

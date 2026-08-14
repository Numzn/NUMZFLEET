/**
 * Single source of truth for every permission NUMZFLEET understands, and the
 * six system roles that bundle them — mirrors the shape of
 * traccar-fleet-system/frontend/src/settings/center/settingsSectionRegistry.js
 * (a plain array instead of role/permission checks hand-written in five
 * different places).
 *
 * This file is additive infrastructure: nothing reads it in a live request
 * yet. src/scripts/seedRolesAndPermissions.js syncs it into the roles/
 * permissions/role_permissions tables; wiring an actual authorization
 * decision to read from those tables is a later, separate step (see the
 * roles/permissions architecture proposal's staged migration plan).
 *
 * Permission keys are namespaced `<module>.<resource>.<action>`, matching
 * the shape already used in docs/PLATFORM_ARCHITECTURE.md's own
 * ExecutionContext examples ('platform.companies.manage', 'vehicles.read',
 * 'fuel.approve') — grounded in the real sections already built into the
 * app sidebar and Settings Hub this session, not invented examples.
 */

export const PERMISSIONS = [
  // Platform — Platform Super Admin only, never bundled into a company role.
  { key: 'platform.companies.manage', category: 'platform', description: 'Register and manage companies (tenants).' },
  { key: 'platform.partners.manage', category: 'platform', description: 'Register and manage partner resellers.' },
  { key: 'platform.audit.read', category: 'platform', description: 'View platform-wide audit logs.' },
  { key: 'platform.settings.manage', category: 'platform', description: 'Manage global platform settings.' },

  // Partner — Partner reseller permissions
  { key: 'partner.customers.read', category: 'partner', description: 'View partner\'s customer roster.' },
  { key: 'partner.customers.manage', category: 'partner', description: 'Create and manage customer accounts under this partner.' },
  { key: 'partner.analytics.read', category: 'partner', description: 'View aggregate analytics for partner\'s customers.' },

  // Fleet — Vehicles, Drivers, Geofences, Maintenance (OPERATIONS > Fleet)
  { key: 'fleet.vehicles.read', category: 'fleet', description: 'View the vehicle registry.' },
  { key: 'fleet.vehicles.manage', category: 'fleet', description: 'Add, edit, or remove vehicles.' },
  { key: 'fleet.drivers.read', category: 'fleet', description: 'View drivers.' },
  { key: 'fleet.drivers.manage', category: 'fleet', description: 'Add, edit, or remove drivers.' },
  { key: 'fleet.geofences.manage', category: 'fleet', description: 'Create and edit geofences.' },
  { key: 'fleet.maintenance.read', category: 'fleet', description: 'View maintenance dashboard and work orders.' },
  { key: 'fleet.maintenance.manage', category: 'fleet', description: 'Create and close work orders.' },

  // Fuel — Fueling Day, Driver requests, Fuel reports
  { key: 'fuel.operations.read', category: 'fuel', description: 'View Fueling Day operations.' },
  { key: 'fuel.operations.manage', category: 'fuel', description: 'Plan, approve, and record Fueling Day operations.' },
  { key: 'fuel.requests.approve', category: 'fuel', description: 'Approve driver fuel requests.' },
  { key: 'fuel.reports.read', category: 'fuel', description: 'View fuel reports.' },

  // Reporting — Analytics, Traccar reports (INTELLIGENCE)
  { key: 'reports.analytics.read', category: 'reporting', description: 'View analytics.' },
  { key: 'reports.traccar.read', category: 'reporting', description: 'View raw Traccar reports.' },

  // Organization — Team, Company info (Settings Hub > Organization)
  { key: 'organization.settings.manage', category: 'organization', description: 'Edit company name and settings.' },
  { key: 'organization.members.manage', category: 'organization', description: 'Invite, edit, and remove team members.' },
  { key: 'organization.roles.manage', category: 'organization', description: 'Assign roles to team members.' },

  // Automation — Alert Rules, Calendars, Computed Attributes, Saved Commands,
  // Maintenance Schedules (Settings Hub > Automation, Fleet)
  { key: 'automation.alerts.manage', category: 'automation', description: 'Configure alert rules.' },
  { key: 'automation.calendars.manage', category: 'automation', description: 'Configure calendars.' },
  { key: 'automation.attributes.manage', category: 'automation', description: 'Configure computed attributes.' },
  { key: 'automation.commands.manage', category: 'automation', description: 'Configure saved device commands.' },
  { key: 'automation.maintenance_schedules.manage', category: 'automation', description: 'Configure maintenance schedule templates.' },

  // Integrations — Devices, Groups (Settings Hub > Integrations)
  { key: 'integrations.devices.manage', category: 'integrations', description: 'Manage GPS device roster and connections.' },
  { key: 'integrations.groups.manage', category: 'integrations', description: 'Manage device groups.' },

  // System — Announcement, Server (Settings Hub > System)
  { key: 'system.announcement.manage', category: 'system', description: 'Broadcast an announcement banner.' },
  { key: 'system.server.manage', category: 'system', description: 'Edit raw server configuration.' },
];

/**
 * Eight system roles (company-scoped, except platform_super_admin) and the
 * permission keys each bundles. "Viewer" is deliberately not a role here —
 * see the domain-model discussion: read-only is a modifier on any role, not
 * a seventh bundle to keep in sync by hand. "driver" is kept because it
 * already exists as a real, populated concept in today's app_role enum.
 */
export const SYSTEM_ROLES = [
  {
    key: 'platform_super_admin',
    label: 'Platform Super Admin',
    permissions: [
      'platform.companies.manage',
      'platform.partners.manage',
      'platform.audit.read',
      'platform.settings.manage',
    ],
  },
  {
    key: 'partner_admin',
    label: 'Partner Admin',
    permissions: [
      'partner.customers.read',
      'partner.customers.manage',
      'partner.analytics.read',
    ],
  },
  {
    key: 'company_admin',
    label: 'Company Admin',
    permissions: PERMISSIONS
      .filter((p) => p.category !== 'platform' && p.category !== 'partner')
      .map((p) => p.key),
  },
  {
    key: 'fleet_manager',
    label: 'Fleet Manager',
    permissions: [
      'fleet.vehicles.read', 'fleet.vehicles.manage',
      'fleet.drivers.read', 'fleet.drivers.manage',
      'fleet.geofences.manage',
      'fleet.maintenance.read', 'fleet.maintenance.manage',
      'reports.analytics.read',
      'fuel.reports.read',
    ],
  },
  {
    key: 'dispatcher',
    label: 'Dispatcher',
    permissions: [
      'fleet.vehicles.read',
      'fleet.drivers.read',
      'fleet.geofences.manage',
      'automation.alerts.manage',
    ],
  },
  {
    key: 'fuel_team',
    label: 'Fuel Team',
    permissions: [
      'fuel.operations.read', 'fuel.operations.manage',
      'fuel.requests.approve',
      'fuel.reports.read',
    ],
  },
  {
    key: 'technician',
    label: 'Technician',
    permissions: [
      'fleet.maintenance.read', 'fleet.maintenance.manage',
      'integrations.devices.manage',
      'automation.commands.manage',
      'automation.maintenance_schedules.manage',
    ],
  },
  {
    key: 'driver',
    label: 'Driver',
    permissions: [
      'fleet.vehicles.read',
      'fuel.operations.read',
    ],
  },
];

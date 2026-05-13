/**
 * Single source of truth for Fleet workspace tab routes (Operations / Fuel / Vehicles).
 * Used by ContextStrip and FleetWorkspaceShell to avoid matcher drift.
 */
export const FLEET_WORKSPACE_TABS = [
  {
    label: 'Operations',
    path: '/fleet/operation-sessions',
    match: (pathname) => pathname === '/fleet/operation-sessions'
      || pathname.startsWith('/fleet/operation-sessions/'),
  },
  {
    label: 'Fuel requests',
    path: '/fuel-requests',
    match: (pathname) => pathname === '/fuel-requests'
      || pathname.startsWith('/fuel-requests/'),
  },
  {
    label: 'Vehicles',
    path: '/fleet/vehicles',
    match: (pathname) => pathname === '/fleet/vehicles'
      || pathname.startsWith('/fleet/vehicles/'),
  },
];

export function isFleetWorkspacePath(pathname) {
  return FLEET_WORKSPACE_TABS.some((t) => t.match(pathname));
}

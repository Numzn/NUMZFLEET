/**
 * Frozen inventory of every route Navigation.jsx declares, plus the parser that
 * derives it.
 *
 * Silently dropping or renaming a route is the characteristic failure mode of an
 * in-place UI refactor: nothing throws, lint stays clean, the build stays green,
 * and a page simply stops being reachable until a user reports it. `ROUTES` is
 * checked in so that any change to the route table has to be made deliberately,
 * in the same commit that causes it. It also doubles as the manual smoke
 * checklist for a phase that touches routing.
 *
 * This parses Navigation.jsx as text rather than importing it, because importing
 * that module pulls in the whole page graph (MUI, maplibre, the redux store) —
 * far too heavy for a unit test, and it would need a DOM.
 */

/**
 * Finds the `>` that closes a JSX opening tag, skipping any `>` nested inside a
 * braced expression — `element={<Navigate to="/x" replace />}` contains both `>`
 * and `/>` that must not terminate the outer tag.
 */
function findTagEnd(source, start) {
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const char = source[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    } else if (char === '>' && depth === 0) {
      return { end: i, selfClosing: source[i - 1] === '/' };
    }
    i += 1;
  }
  throw new Error(`Unterminated <Route> tag at index ${start}`);
}

/**
 * Joins nested route segments into one absolute path. Segments may be absolute
 * ('/login'), multi-part ('fleet/vehicles/:id'), or empty — a pathless layout
 * route such as `<Route element={<UnifiedShell />}>` contributes nothing.
 */
function toAbsolutePath(segments) {
  const parts = [];
  segments.forEach((segment) => {
    segment.split('/').forEach((part) => {
      if (part) parts.push(part);
    });
  });
  return parts.length ? `/${parts.join('/')}` : '/';
}

/** Every absolute route `source` declares, sorted and de-duplicated. */
export function parseRouteManifest(source) {
  const tokens = [];
  const tokenPattern = /<\/?Route\b/g;
  let match = tokenPattern.exec(source);
  while (match) {
    tokens.push({ index: match.index, closing: source.startsWith('</', match.index) });
    match = tokenPattern.exec(source);
  }

  const routes = new Set();
  const stack = [];
  tokens.forEach(({ index, closing }) => {
    if (closing) {
      stack.pop();
      return;
    }
    const { end, selfClosing } = findTagEnd(source, index);
    const tag = source.slice(index, end + 1);
    const pathMatch = /path="([^"]*)"/.exec(tag);
    if (pathMatch) {
      routes.add(toAbsolutePath([...stack, pathMatch[1]]));
    } else if (/\bindex\b/.test(tag)) {
      routes.add(toAbsolutePath(stack));
    }
    if (!selfClosing) {
      stack.push(pathMatch ? pathMatch[1] : '');
    }
  });

  return [...routes].sort();
}

/**
 * The frozen manifest. Update this in the SAME commit as any deliberate route
 * change — never to turn a red build green.
 *
 * Known oddity, pre-existing: `/reports` is a parent `<Route>` with no element
 * and no index child, so navigating there renders nothing. It is listed because
 * it is genuinely declared; fixing it is out of scope for the safety net.
 */
export const ROUTES = [
  '/',
  '/change-server',
  '/emulator',
  '/event/:id',
  '/fleet/drivers',
  '/fleet/drivers/:id',
  '/fleet/drivers/new',
  '/fleet/operation-sessions',
  '/fleet/operation-sessions/create',
  '/fleet/operation-sessions/forecast',
  '/fleet/operation-sessions/fuel',
  '/fleet/operation-sessions/fuel/:sessionId',
  '/fleet/operation-sessions/history',
  '/fleet/operation-sessions/invoices',
  '/fleet/operation-sessions/plan',
  '/fleet/operation-sessions/prepare',
  '/fleet/operation-sessions/review',
  '/fleet/operation-sessions/run/:sessionId',
  '/fleet/vehicles',
  '/fleet/vehicles/:vehicleId',
  '/fleet/vehicles/:vehicleId/immobilizer',
  '/fleet/vehicles/:vehicleId/setup',
  '/fuel-requests',
  '/geofences',
  '/login',
  '/maintenance',
  '/map',
  '/network/:positionId',
  '/position/:id',
  '/register',
  '/replay',
  '/reports',
  '/reports/audit',
  '/reports/chart',
  '/reports/combined',
  '/reports/events',
  '/reports/fuel-operations',
  '/reports/logs',
  '/reports/route',
  '/reports/scheduled',
  '/reports/statistics',
  '/reports/stops',
  '/reports/summary',
  '/reports/trips',
  '/reset-password',
  '/saas/partner/customers',
  '/saas/partner/overview',
  '/saas/platform/direct-customers',
  '/saas/platform/overview',
  '/saas/platform/partners',
  '/settings',
  '/settings/accumulators/:deviceId',
  '/settings/announcement',
  '/settings/attribute',
  '/settings/attribute/:id',
  '/settings/attributes',
  '/settings/calendar',
  '/settings/calendar/:id',
  '/settings/calendars',
  '/settings/command',
  '/settings/command/:id',
  '/settings/commands',
  '/settings/device',
  '/settings/device/:id',
  '/settings/device/:id/command',
  '/settings/device/:id/connections',
  '/settings/device/:id/share',
  '/settings/devices',
  '/settings/driver',
  '/settings/driver/:id',
  '/settings/drivers',
  '/settings/geofence',
  '/settings/geofence/:id',
  '/settings/group',
  '/settings/group/:id',
  '/settings/group/:id/command',
  '/settings/group/:id/connections',
  '/settings/groups',
  '/settings/maintenance',
  '/settings/maintenance/:id',
  '/settings/maintenances',
  '/settings/notification',
  '/settings/notification-preferences',
  '/settings/notification/:id',
  '/settings/notifications',
  '/settings/preferences',
  '/settings/profile',
  '/settings/roles',
  '/settings/security',
  '/settings/server',
  '/settings/user',
  '/settings/user/:id',
  '/settings/user/:id/connections',
  '/settings/users',
  '/test/toast-notifications',
];

/**
 * Whether a concrete link target is reachable, treating `:param` segments as
 * wildcards. Query string and hash are ignored — `/reports/trips?from=x` is the
 * `/reports/trips` route.
 */
export function routeMatches(target, routes = ROUTES) {
  const targetParts = target.split('?')[0].split('#')[0].split('/').filter(Boolean);
  return routes.some((route) => {
    const routeParts = route.split('/').filter(Boolean);
    if (routeParts.length !== targetParts.length) return false;
    return routeParts.every((part, i) => part.startsWith(':') || part === targetParts[i]);
  });
}

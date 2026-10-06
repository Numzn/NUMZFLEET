import { isSettingsSectionVisible, resolveActiveSettingsSection } from './settingsSectionRegistry.js';

/**
 * Route-level access to /settings/*.
 *
 * The sidebar only decides what is SHOWN; typing a URL bypasses it. This applies the
 * very same rule the sidebar uses (isSettingsSectionVisible, from the section
 * registry) to the URL itself, so there is one gating rule and no second permission
 * system. A /settings path is allowed only when:
 *   - it belongs to a registry section the current identity may see, or
 *   - it is on the short, explicit list of intentionally-open paths below.
 * Anything else is denied by default — a new /settings route must be classified
 * (a registry section or an entry here) before anyone can reach it.
 *
 * This is the frontend half. Several of these pages still call Traccar directly from
 * the browser, where Traccar's own ACL is the only server-side check; that remains
 * until the direct-Traccar surface is migrated behind fuel-api (TENANCY Phase 3).
 */

// Engineering-only screens that are not sidebar sections. Checked BEFORE the
// registry because their prefix would otherwise match a broader section (Devices).
const PLATFORM_OWNER_ONLY_PATHS = [
  /^\/settings\/device\/[^/]+\/command$/, // raw tracker command console
];

// Not sidebar sections, but intentionally open to any signed-in user.
const OPEN_PATHS = [
  /^\/settings\/geofence(\/[^/]+)?$/, // the zone editor reached from Zones / vehicle setup
  /^\/settings\/driver(s|\/[^/]+)?$/, // legacy redirects into People / Fleet drivers
  /^\/settings\/users$/, // legacy redirect into People
];

const normalize = (pathname) => {
  const path = String(pathname || '').split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
};

/**
 * @param {string} pathname
 * @param {Parameters<typeof isSettingsSectionVisible>[1]} gates the same gate inputs
 *   the sidebar uses: { manager, admin, technician, platformOwner, features, currentContextType }
 */
export function isSettingsPathAllowed(pathname, gates = {}) {
  const path = normalize(pathname);
  if (PLATFORM_OWNER_ONLY_PATHS.some((pattern) => pattern.test(path))) {
    return Boolean(gates.platformOwner);
  }
  const section = resolveActiveSettingsSection(path);
  if (section) return isSettingsSectionVisible(section, gates);
  return OPEN_PATHS.some((pattern) => pattern.test(path));
}

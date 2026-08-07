/**
 * Which set of destinations the single sidebar is showing.
 *
 * Settings used to render its own permanent rail beside the app's, so a user in
 * Settings saw two navigation systems stacked left-to-right and had to navigate
 * twice to reach a page. There is now one sidebar whose *contents* swap: enter
 * Settings and you switch workspace, you do not open a nested panel.
 *
 * Derived from the pathname rather than held in state, for the same reason the
 * vehicle workspace derives its tab from the URL — a deep link, a refresh and a
 * click must all land in the same place.
 */

export const NAV_WORKSPACES = {
  operational: 'operational',
  settings: 'settings',
};

export const SETTINGS_ROOT = '/settings';

/** Where "Exit Settings" goes when there is no operational page to return to. */
export const OPERATIONAL_HOME = '/';

/** @returns {'operational' | 'settings'} */
export function resolveNavWorkspace(pathname) {
  if (pathname === SETTINGS_ROOT || pathname.startsWith(`${SETTINGS_ROOT}/`)) {
    return NAV_WORKSPACES.settings;
  }
  return NAV_WORKSPACES.operational;
}

export function isSettingsWorkspace(pathname) {
  return resolveNavWorkspace(pathname) === NAV_WORKSPACES.settings;
}

/**
 * Where "Exit Settings" should return to.
 *
 * Returning to the page the user came from is what makes this feel like
 * switching workspaces rather than navigating; falls back to the dashboard when
 * Settings was opened directly by URL or after a refresh, since there is no
 * previous operational page in that case.
 */
export function resolveExitTarget(lastOperationalPath) {
  if (!lastOperationalPath || isSettingsWorkspace(lastOperationalPath)) {
    return OPERATIONAL_HOME;
  }
  return lastOperationalPath;
}

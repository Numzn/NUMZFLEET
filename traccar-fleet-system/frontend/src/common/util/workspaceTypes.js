/** @typedef {'default' | 'live' | 'fullscreen'} WorkspaceType */

const FULLSCREEN_PREFIXES = [
  '/replay',
  '/geofences',
  '/emulator',
];

/**
 * @param {string} pathname
 * @returns {WorkspaceType}
 */
export function getWorkspaceType(pathname) {
  if (pathname === '/map') {
    return 'live';
  }
  if (FULLSCREEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return 'fullscreen';
  }
  if (pathname.startsWith('/position/') || pathname.startsWith('/network/') || pathname.startsWith('/event/')) {
    return 'fullscreen';
  }
  return 'default';
}

export function isLiveWorkspacePath(pathname) {
  return getWorkspaceType(pathname) === 'live';
}

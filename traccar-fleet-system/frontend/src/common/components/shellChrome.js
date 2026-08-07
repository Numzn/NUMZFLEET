/**
 * Which navigation chrome UnifiedShell renders, for a given workspace type and
 * breakpoint.
 *
 * Pulled out of the JSX so the rule is a value that can be asserted, rather than
 * three separate render conditions that have to agree with each other by
 * inspection. It replaced exactly that: three near-identical temporary <Drawer>s
 * whose conditions were `!isLive && !isFullscreen && !desktop`, `isLive &&
 * !desktop`, and `isFullscreen` — see shellChrome.test.js, which pins the union
 * against those original expressions across the whole matrix.
 */

/** @typedef {'default' | 'live' | 'fullscreen'} WorkspaceType */

/**
 * @param {{ workspaceType: WorkspaceType, desktop: boolean }} input
 * @returns {{
 *   showPermanentNav: boolean,
 *   showTemporaryNav: boolean,
 *   showLiveFleetRail: boolean,
 * }}
 */
export function resolveShellChrome({ workspaceType, desktop }) {
  const isLive = workspaceType === 'live';
  const isFullscreen = workspaceType === 'fullscreen';

  return {
    // The app's own sidebar, in-flow beside the content.
    showPermanentNav: !isLive && !isFullscreen && desktop,
    // Below `md` neither the default workspace nor the live map has room for a
    // permanent rail, and fullscreen pages have no rail at any width — so all
    // three fall back to the same drawer.
    showTemporaryNav: !desktop || isFullscreen,
    // The live map's own device list, which is not the app nav.
    showLiveFleetRail: isLive && desktop,
  };
}

export default resolveShellChrome;

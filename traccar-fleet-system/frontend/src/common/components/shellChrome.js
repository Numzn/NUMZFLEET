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

  return {
    // The app's own sidebar — the spine. Present on every workspace at
    // desktop width, full stop — live map and fullscreen both force it to
    // render collapsed (see UnifiedShell's `forceCollapsed`) rather than
    // excluding it, so organization identity and primary navigation are
    // never fully absent anywhere. Workspace type no longer decides whether
    // the spine shows, only what the content area beyond it looks like —
    // that's a real simplification: nav visibility was never actually a
    // workspace-specific concern, only density was.
    showPermanentNav: desktop,
    // Below `md` nothing has room for a permanent rail — every workspace
    // falls back to the same drawer, uniformly.
    showTemporaryNav: !desktop,
    // The live map's own device list, which is not the app nav.
    showLiveFleetRail: isLive && desktop,
  };
}

export default resolveShellChrome;

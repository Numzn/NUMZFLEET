import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveShellChrome } from './shellChrome.js';

const WORKSPACE_TYPES = ['default', 'live', 'fullscreen'];
const BREAKPOINTS = [true, false];

const MATRIX = WORKSPACE_TYPES.flatMap((workspaceType) => (
  BREAKPOINTS.map((desktop) => ({ workspaceType, desktop }))
));

test('the permanent rail and the temporary drawer are both decided by breakpoint alone, uniformly', () => {
  // The three-workspace-type special-casing this file used to pin (live map
  // and fullscreen each carved out their own drawer/no-rail rule) is gone.
  // Nav visibility was never actually a workspace-specific concern — only
  // how dense the content beyond the rail gets to be is. See the "One Shell,
  // Two Speeds" design doc and its Phase 5 extension to fullscreen.
  MATRIX.forEach((input) => {
    const { showPermanentNav, showTemporaryNav } = resolveShellChrome(input);
    assert.equal(showPermanentNav, input.desktop, `${input.workspaceType} / ${input.desktop ? 'desktop' : 'mobile'}: showPermanentNav should equal desktop`);
    assert.equal(showTemporaryNav, !input.desktop, `${input.workspaceType} / ${input.desktop ? 'desktop' : 'mobile'}: showTemporaryNav should equal !desktop`);
  });
});

test('every surface can reach the app nav from the shell', () => {
  // Live map and fullscreen used to be exceptions (see the "One Shell, Two
  // Speeds" design doc) — desktop live map had neither a permanent rail nor
  // a drawer, only a single unlabeled "Back to fleet dashboard" icon as its
  // sole route out; fullscreen pages never got a permanent rail at any
  // width. Both exceptions are gone: every workspace gets the same
  // permanent rail on desktop, just forced into its collapsed (icon-only)
  // rendering by UnifiedShell for live map and fullscreen — see shellChrome
  // and UnifiedShell's `forceCollapsed`.
  MATRIX.forEach((input) => {
    const { showPermanentNav, showTemporaryNav } = resolveShellChrome(input);
    assert.ok(
      showPermanentNav || showTemporaryNav,
      `${input.workspaceType} / ${input.desktop ? 'desktop' : 'mobile'} has no route to the app nav`,
    );
  });
});

test('the live map gets the same permanent rail as every other desktop surface, plus its own fleet rail', () => {
  // Desktop: the app rail (forced collapsed by UnifiedShell) and the fleet
  // rail render together — spine leftmost, fleet rail to its right, map last.
  // Mobile: unchanged — falls back to the shared drawer, opened from
  // LiveMapTopBar's app-menu button, same as before this change.
  const desktopLive = resolveShellChrome({ workspaceType: 'live', desktop: true });
  assert.deepEqual(desktopLive, {
    showPermanentNav: true,
    showTemporaryNav: false,
    showLiveFleetRail: true,
  });

  const mobileLive = resolveShellChrome({ workspaceType: 'live', desktop: false });
  assert.deepEqual(mobileLive, {
    showPermanentNav: false,
    showTemporaryNav: true,
    showLiveFleetRail: false,
  });
});

test('permanent and temporary nav are mutually exclusive', () => {
  MATRIX.forEach((input) => {
    const { showPermanentNav, showTemporaryNav } = resolveShellChrome(input);
    assert.equal(
      showPermanentNav && showTemporaryNav,
      false,
      `${input.workspaceType} / ${input.desktop ? 'desktop' : 'mobile'} renders both nav variants`,
    );
  });
});

test('fullscreen pages get the same permanent rail as everyone else on desktop', () => {
  // /replay, /geofences and /emulator used to have no permanent rail at any
  // width, relying on a drawer even on desktop — the one remaining special
  // case from the original three-workspace model. Now they get the same
  // forced-collapsed spine as live map; UnifiedShell's own fullscreen
  // topbar hamburger is mobile-only from here on, since desktop has the
  // real rail instead.
  const { showPermanentNav, showTemporaryNav } = resolveShellChrome({
    workspaceType: 'fullscreen',
    desktop: true,
  });
  assert.equal(showPermanentNav, true);
  assert.equal(showTemporaryNav, false);
});

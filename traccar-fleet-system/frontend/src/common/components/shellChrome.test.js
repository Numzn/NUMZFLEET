import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveShellChrome } from './shellChrome.js';

const WORKSPACE_TYPES = ['default', 'live', 'fullscreen'];
const BREAKPOINTS = [true, false];

const MATRIX = WORKSPACE_TYPES.flatMap((workspaceType) => (
  BREAKPOINTS.map((desktop) => ({ workspaceType, desktop }))
));

/**
 * The three render conditions that existed before consolidation, transcribed
 * verbatim. The single drawer must open in exactly the union of these — no
 * more (a drawer appearing where none did) and no less (a surface losing its
 * only way to reach navigation).
 */
function legacyTemporaryDrawers({ workspaceType, desktop }) {
  const isLive = workspaceType === 'live';
  const isFullscreen = workspaceType === 'fullscreen';
  return [
    !isLive && !isFullscreen && !desktop, // default workspace, mobile
    isLive && !desktop, // live map, mobile
    isFullscreen, // fullscreen pages, any width
  ];
}

test('the single temporary drawer is the exact union of the three it replaced', () => {
  MATRIX.forEach((input) => {
    const expected = legacyTemporaryDrawers(input).some(Boolean);
    const { showTemporaryNav } = resolveShellChrome(input);
    assert.equal(
      showTemporaryNav,
      expected,
      `${input.workspaceType} / ${input.desktop ? 'desktop' : 'mobile'}: expected showTemporaryNav=${expected}`,
    );
  });
});

test('at most one of the three legacy drawers ever applied at once', () => {
  // This is why they could collapse to one open-state instead of three.
  MATRIX.forEach((input) => {
    const active = legacyTemporaryDrawers(input).filter(Boolean).length;
    assert.ok(
      active <= 1,
      `${input.workspaceType} / ${input.desktop ? 'desktop' : 'mobile'}: ${active} drawers applied at once`,
    );
  });
});

test('every surface can reach the app nav from the shell', () => {
  // Live map used to be the one exception (see the "One Shell, Two Speeds"
  // design doc) — desktop live map had neither a permanent rail nor a drawer,
  // only a single unlabeled "Back to fleet dashboard" icon in LiveMapTopBar as
  // its sole route out. That exception is gone: live map now gets the same
  // permanent rail as every other desktop surface, just forced into its
  // collapsed (icon-only) rendering by UnifiedShell — see shellChrome and
  // UnifiedShell's `forceCollapsed`.
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

test('fullscreen pages get a drawer even on desktop', () => {
  // /replay, /geofences and /emulator have no permanent rail at any width, so
  // the drawer is their only way back into the app.
  const { showPermanentNav, showTemporaryNav } = resolveShellChrome({
    workspaceType: 'fullscreen',
    desktop: true,
  });
  assert.equal(showPermanentNav, false);
  assert.equal(showTemporaryNav, true);
});

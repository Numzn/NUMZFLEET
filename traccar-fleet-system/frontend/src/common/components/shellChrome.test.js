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

test('every surface except the live map can reach the app nav from the shell', () => {
  MATRIX.filter(({ workspaceType }) => workspaceType !== 'live').forEach((input) => {
    const { showPermanentNav, showTemporaryNav } = resolveShellChrome(input);
    assert.ok(
      showPermanentNav || showTemporaryNav,
      `${input.workspaceType} / ${input.desktop ? 'desktop' : 'mobile'} has no route to the app nav`,
    );
  });
});

test('the live map owns its own navigation and never gets the app rail', () => {
  // Deliberate: on desktop the live map is a full-bleed canvas with no app rail
  // and no drawer — LiveMapTopBar.jsx:258 supplies a "Back to fleet dashboard"
  // button instead. On mobile it falls back to the shared drawer, opened from
  // that same top bar. Asserted so a future change to resolveShellChrome cannot
  // quietly strand the map without noticing this is the arrangement.
  const desktopLive = resolveShellChrome({ workspaceType: 'live', desktop: true });
  assert.deepEqual(desktopLive, {
    showPermanentNav: false,
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

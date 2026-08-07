import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NAV_WORKSPACES,
  OPERATIONAL_HOME,
  isSettingsWorkspace,
  resolveExitTarget,
  resolveNavWorkspace,
} from './navWorkspace.js';
import { ROUTES } from '../../routeManifest.js';

test('every /settings route resolves to the settings workspace', () => {
  const settingsRoutes = ROUTES.filter((route) => route.startsWith('/settings'));
  assert.ok(settingsRoutes.length > 10, 'expected the settings routes from the manifest');
  settingsRoutes.forEach((route) => {
    assert.equal(resolveNavWorkspace(route), NAV_WORKSPACES.settings, route);
  });
});

test('no other route resolves to the settings workspace', () => {
  ROUTES.filter((route) => !route.startsWith('/settings')).forEach((route) => {
    assert.equal(resolveNavWorkspace(route), NAV_WORKSPACES.operational, route);
  });
});

test('a path merely prefixed with "settings" is not the settings workspace', () => {
  // Guards the naive startsWith('/settings') that would swallow these.
  assert.equal(isSettingsWorkspace('/settings-export'), false);
  assert.equal(isSettingsWorkspace('/settingsomething'), false);
  assert.equal(isSettingsWorkspace('/settings'), true);
  assert.equal(isSettingsWorkspace('/settings/team'), true);
});

test('exiting returns to the page the user came from', () => {
  assert.equal(resolveExitTarget('/fleet/vehicles'), '/fleet/vehicles');
  assert.equal(resolveExitTarget('/maintenance'), '/maintenance');
});

test('exiting falls back to the dashboard when there is nowhere to return to', () => {
  // Settings opened directly by URL, or after a refresh.
  assert.equal(resolveExitTarget(null), OPERATIONAL_HOME);
  assert.equal(resolveExitTarget(undefined), OPERATIONAL_HOME);
  assert.equal(resolveExitTarget(''), OPERATIONAL_HOME);
  // Never bounce back into Settings.
  assert.equal(resolveExitTarget('/settings/team'), OPERATIONAL_HOME);
});

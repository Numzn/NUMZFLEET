import test from 'node:test';
import assert from 'node:assert/strict';

import { ROUTES, routeMatches } from '../../routeManifest.js';
import { isSettingsPathAllowed } from './settingsRouteAccess.js';
import {
  SETTINGS_SECTIONS, buildSettingsNavGroups, isSettingsSectionVisible,
} from './settingsSectionRegistry.js';

/**
 * The sidebar decides what is SHOWN; the route guard decides what can be OPENED.
 * Both use the same rule, so a user can never reach by URL what the sidebar would
 * not have offered them.
 */

const NOBODY = { features: {} };
const MANAGER = { manager: true, features: {} };
const TECHNICIAN = { technician: true, features: {} };
// Traccar administrator with no NUMZFLEET role = platform owner; admin implies manager + technician.
const PLATFORM_OWNER = {
  manager: true, admin: true, technician: true, platformOwner: true, features: {},
};

const PROFILES = {
  'an ordinary user': NOBODY,
  'a manager': MANAGER,
  'a technician': TECHNICIAN,
  'the platform owner': PLATFORM_OWNER,
};

const allowed = (path, gates) => isSettingsPathAllowed(path, gates);

test('an ordinary user can open only their own personal pages', () => {
  for (const path of ['/settings', '/settings/profile', '/settings/security', '/settings/preferences', '/settings/notification-preferences']) {
    assert.equal(allowed(path, NOBODY), true, path);
  }
  for (const path of [
    '/settings/people', '/settings/people/user/3', '/settings/roles', '/settings/devices', '/settings/device',
    '/settings/device/62', '/settings/announcement', '/settings/server', '/settings/calendars',
    '/settings/attributes', '/settings/device/62/command',
  ]) {
    assert.equal(allowed(path, NOBODY), false, `${path} must not open by URL`);
  }
});

test('typing the URL of a removed page opens nothing for anyone', () => {
  const removed = [
    '/settings/maintenances', '/settings/maintenance', '/settings/maintenance/1',
    '/settings/notifications', '/settings/notification', '/settings/notification/1',
    '/settings/groups', '/settings/group', '/settings/group/1', '/settings/group/1/connections', '/settings/group/1/command',
    '/settings/commands', '/settings/command', '/settings/command/1',
    '/settings/accumulators/62', '/settings/device/62/connections', '/settings/device/62/share',
    '/settings/user', '/settings/user/3',
  ];
  // A path is "openable" only if the guard lets the user in AND a route is declared
  // for it. Some removed URLs (e.g. /settings/device/62/share) still prefix-match the
  // Devices section in the guard, but there is no route behind them, so nothing renders.
  for (const [who, gates] of Object.entries(PROFILES)) {
    for (const path of removed) {
      const openable = allowed(path, gates) && routeMatches(path);
      assert.equal(openable, false, `${who} must not reach ${path}`);
    }
  }
});

test('managers get People, Roles and Announcement — and nothing engineering', () => {
  for (const path of ['/settings/people', '/settings/people/driver/9', '/settings/roles', '/settings/announcement']) {
    assert.equal(allowed(path, MANAGER), true, path);
  }
  for (const path of ['/settings/devices', '/settings/server', '/settings/attributes', '/settings/calendars', '/settings/device/62/command']) {
    assert.equal(allowed(path, MANAGER), false, path);
  }
});

test('technicians get Devices (list, register, edit) but not the raw command console', () => {
  for (const path of ['/settings/devices', '/settings/device', '/settings/device/62']) {
    assert.equal(allowed(path, TECHNICIAN), true, path);
  }
  assert.equal(allowed('/settings/device/62/command', TECHNICIAN), false);
  assert.equal(allowed('/settings/server', TECHNICIAN), false);
});

test('engineering screens are the platform owner only: Server, Computed Attributes, Calendars, raw device command', () => {
  for (const path of ['/settings/server', '/settings/attributes', '/settings/attribute/1', '/settings/calendars', '/settings/calendar/2', '/settings/device/62/command']) {
    assert.equal(allowed(path, PLATFORM_OWNER), true, path);
  }
});

test('a trailing slash or query string does not slip past the guard', () => {
  assert.equal(allowed('/settings/server/', NOBODY), false);
  assert.equal(allowed('/settings/server?x=1', NOBODY), false);
  assert.equal(allowed('/settings/people/', NOBODY), false);
  assert.equal(allowed('/settings/', NOBODY), true);
});

test('an unknown /settings path is denied by default', () => {
  assert.equal(allowed('/settings/not-a-real-page', PLATFORM_OWNER), false);
});

test('every /settings route in the route manifest is classified: a sidebar section or an explicit open path', () => {
  // '/settings/*' is the catch-all that sends unknown URLs to the overview; it is not a page.
  const settingsRoutes = ROUTES.filter((route) => (route === '/settings' || route.startsWith('/settings/'))
    && route !== '/settings/*');
  assert.ok(settingsRoutes.length > 10, 'sanity: the manifest has settings routes');
  const unclassified = settingsRoutes
    .map((route) => route.replace(/:[A-Za-z]+/g, '1'))
    .filter((path) => !allowed(path, PLATFORM_OWNER));
  assert.deepEqual(
    unclassified,
    [],
    'A /settings route is not covered by the registry or the open-path list, so nobody can reach it. Classify it in settingsSectionRegistry.js or settingsRouteAccess.js.',
  );
});

test('the removed Traccar pages are gone from the route manifest', () => {
  for (const route of [
    '/settings/maintenances', '/settings/notifications', '/settings/groups', '/settings/commands',
    '/settings/accumulators/:deviceId', '/settings/device/:id/share', '/settings/device/:id/connections',
    '/settings/group/:id/connections', '/settings/user',
  ]) {
    assert.equal(ROUTES.includes(route), false, route);
  }
});

// ---------------------------------------------------------------------------
// The sidebar
// ---------------------------------------------------------------------------

const sidebarLabels = (gates) => buildSettingsNavGroups(gates).flatMap((group) => group.sections.map((s) => s.label));

test('the sidebar never lists generic Traccar administration', () => {
  for (const [who, gates] of Object.entries(PROFILES)) {
    const labels = sidebarLabels(gates);
    for (const gone of ['Alert Rules', 'Groups', 'Saved Commands', 'Maintenance Schedules']) {
      assert.equal(labels.includes(gone), false, `${who} must not see "${gone}"`);
    }
  }
});

test('the sidebar shows exactly the NUMZFLEET sections each kind of user is entitled to', () => {
  assert.deepEqual(sidebarLabels(NOBODY), ['Overview', 'Profile', 'Security', 'Preferences', 'Notifications']);
  assert.deepEqual(sidebarLabels(MANAGER), [
    'Overview', 'Profile', 'Security', 'Preferences', 'Notifications', 'People', 'Roles', 'Announcement',
  ]);
  assert.deepEqual(sidebarLabels(TECHNICIAN), [
    'Overview', 'Profile', 'Security', 'Preferences', 'Notifications', 'Devices',
  ]);
  assert.deepEqual(sidebarLabels(PLATFORM_OWNER), [
    'Overview', 'Profile', 'Security', 'Preferences', 'Notifications', 'People', 'Roles', 'Devices',
    'Calendars', 'Computed Attributes', 'Announcement', 'Server', 'Platform',
  ]);
});

test('the sidebar never renders an empty group heading', () => {
  for (const [who, gates] of Object.entries(PROFILES)) {
    for (const group of buildSettingsNavGroups(gates)) {
      assert.ok(group.sections.length > 0, `${who}: empty group "${group.key}"`);
    }
  }
});

test('every sidebar link opens for the same user, and every hidden section stays closed to them', () => {
  for (const [who, gates] of Object.entries(PROFILES)) {
    const shown = new Set(buildSettingsNavGroups(gates).flatMap((group) => group.sections.map((s) => s.id)));
    for (const section of SETTINGS_SECTIONS) {
      if (!section.path.startsWith('/settings')) continue; // Platform / Business live under /saas
      if (shown.has(section.id)) {
        assert.equal(allowed(section.path, gates), true, `${who}: sidebar link ${section.path} is a dead link`);
      } else {
        assert.equal(allowed(section.path, gates), false, `${who}: ${section.path} is hidden but reachable by URL`);
      }
      assert.equal(isSettingsSectionVisible(section, gates), shown.has(section.id));
    }
  }
});

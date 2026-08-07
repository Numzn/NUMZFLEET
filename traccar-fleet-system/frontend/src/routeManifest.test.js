import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ROUTES, parseRouteManifest, routeMatches } from './routeManifest.js';

const here = dirname(fileURLToPath(import.meta.url));
const navigationSource = readFileSync(join(here, 'Navigation.jsx'), 'utf8');

test('Navigation.jsx declares exactly the frozen route manifest', () => {
  const actual = parseRouteManifest(navigationSource);
  const added = actual.filter((route) => !ROUTES.includes(route));
  const removed = ROUTES.filter((route) => !actual.includes(route));

  assert.deepEqual(
    { added, removed },
    { added: [], removed: [] },
    [
      'The route table changed.',
      '',
      `  added:   ${added.join(', ') || '(none)'}`,
      `  removed: ${removed.join(', ') || '(none)'}`,
      '',
      'If this was deliberate, update ROUTES in src/routeManifest.js in THIS commit.',
      'If it was not, a route was dropped or renamed by accident — that is exactly',
      'what this test exists to catch. A removed route means a page is no longer',
      'reachable; check for a redirect before deleting it.',
    ].join('\n'),
  );
});

test('the manifest parser resolves nested and pathless routes', () => {
  const source = `
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<App />}>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="fleet/vehicles" element={<Vehicles />} />
        <Route path="reports">
          <Route path="trips" element={<Trips />} />
        </Route>
      </Route>
    </Route>
  `;
  assert.deepEqual(parseRouteManifest(source), [
    '/',
    '/fleet/vehicles',
    '/login',
    '/reports',
    '/reports/trips',
  ]);
});

test('the parser is not confused by JSX nested in an element prop', () => {
  // element={<Navigate ... />} contains both '>' and '/>' that must not
  // terminate the outer <Route> tag, and must not register as a route.
  const source = '<Route path="old" element={<Navigate to="/new" replace />} />';
  assert.deepEqual(parseRouteManifest(source), ['/old']);
});

test('routeMatches treats :param segments as wildcards', () => {
  assert.equal(routeMatches('/fleet/vehicles/18'), true);
  assert.equal(routeMatches('/fleet/vehicles/18/setup'), true);
  assert.equal(routeMatches('/'), true);
  assert.equal(routeMatches('/reports/trips?from=2026-08-01'), true);
  assert.equal(routeMatches('/fleet/vehicles/18/nope'), false);
  assert.equal(routeMatches('/not-a-route'), false);
});

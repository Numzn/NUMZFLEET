import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { ROUTES, routeMatches } from './routeManifest.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Every in-app link target the codebase hardcodes must resolve to a real route.
 *
 * This exists because `common/util/navigationParents.js` — the canonical table of
 * "where does Back go" — fails silently: a stale value there sends the user to a
 * dead URL with no error anywhere. Route paths are also spread across ~24 files
 * as bare string literals, so a rename during the UI transformation can leave
 * links behind with nothing to flag it.
 *
 * Deliberately limited to static literals in `navigate('/x')` and `to="/x"`.
 * Template literals (`navigate(`/fleet/vehicles/${id}`)`) are not checked — the
 * builders in fleet/vehicleRegistry/vehicleRegistryUtils.js already centralise
 * those, which is the pattern the rest of the app should move toward.
 */

// Escape hatch for genuinely-external or intentionally-unrouted targets.
// Add with a comment explaining why; do not weaken the patterns below.
const ALLOWED_NON_ROUTE_TARGETS = new Set([]);

const NAVIGATE_CALL = /navigate\(\s*['"](\/[^'"]*)['"]/g;
const TO_PROP = /\bto=(?:"(\/[^"]*)"|\{\s*['"](\/[^'"]*)['"])/g;
// navigationParents.js is a plain table of path constants, so every '/…' string
// literal in it is a link target, not just the ones in a navigate() call.
const PATH_LITERAL = /['"](\/[^'"\s]*)['"]/g;

function sourceFiles(dir) {
  const found = [];
  readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (/\.jsx?$/.test(entry.name) && !entry.name.endsWith('.test.js')) {
      found.push(full);
    }
  });
  return found;
}

/**
 * Comments routinely contain illustrative snippets (`element={<Navigate to="/x" />}`),
 * which are documentation, not link targets. Line comments are only stripped when
 * `//` starts a line or follows whitespace, so `http://…` and `'a//b'` survive.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

function collect(source, pattern) {
  const out = [];
  let match = pattern.exec(source);
  while (match) {
    out.push(match[1] || match[2]);
    match = pattern.exec(source);
  }
  pattern.lastIndex = 0;
  return out;
}

function collectTargets() {
  const byTarget = new Map();
  sourceFiles(here).forEach((file) => {
    const source = stripComments(readFileSync(file, 'utf8'));
    const rel = relative(here, file);
    const patterns = rel === join('common', 'util', 'navigationParents.js')
      ? [NAVIGATE_CALL, TO_PROP, PATH_LITERAL]
      : [NAVIGATE_CALL, TO_PROP];
    patterns.forEach((pattern) => {
      collect(source, pattern).forEach((target) => {
        if (!byTarget.has(target)) byTarget.set(target, new Set());
        byTarget.get(target).add(rel);
      });
    });
  });
  return byTarget;
}

test('every hardcoded in-app link target resolves to a declared route', () => {
  const byTarget = collectTargets();
  const broken = [...byTarget.entries()]
    .filter(([target]) => !ALLOWED_NON_ROUTE_TARGETS.has(target) && !routeMatches(target))
    .map(([target, files]) => `  ${target}  <- ${[...files].sort().join(', ')}`);

  assert.deepEqual(
    broken,
    [],
    [
      'These link targets do not match any route in src/routeManifest.js:',
      '',
      ...broken,
      '',
      'Either the route was renamed and these call sites were missed, or the',
      'target is intentionally external — in which case add it to',
      'ALLOWED_NON_ROUTE_TARGETS with a comment saying why.',
    ].join('\n'),
  );
});

test('the scan actually finds targets (guards against a silently broken regex)', () => {
  const byTarget = collectTargets();
  // A pattern that stops matching would make the test above vacuously pass.
  assert.ok(byTarget.size >= 15, `expected to find in-app link targets, found ${byTarget.size}`);
  assert.ok(byTarget.has('/map'), 'expected /map among the collected targets');
  assert.ok(byTarget.has('/fleet/vehicles'), 'expected /fleet/vehicles among the collected targets');
});

test('navigationParents.js constants all point at real routes', () => {
  const source = stripComments(readFileSync(join(here, 'common', 'util', 'navigationParents.js'), 'utf8'));
  const literals = [...new Set(collect(source, PATH_LITERAL))];
  assert.ok(literals.length > 0, 'expected path constants in navigationParents.js');
  literals.forEach((literal) => {
    assert.ok(
      routeMatches(literal, ROUTES),
      `navigationParents.js points at ${literal}, which is not a declared route`,
    );
  });
});

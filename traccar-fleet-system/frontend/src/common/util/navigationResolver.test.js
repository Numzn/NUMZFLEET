import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveNavigation } from './navigationResolver.js';

function titles(navGroups) {
  return navGroups.flatMap((group) => group.items.map((item) => item.title));
}

test('no context (pre-hydration) falls back to the fleet nav', () => {
  const items = titles(resolveNavigation(null));
  assert.ok(items.includes('Dashboard'));
  assert.ok(!items.includes('Partners'));
});

test('customer context always gets the fleet nav — the primary/default experience', () => {
  const items = titles(resolveNavigation({ type: 'customer' }));
  assert.ok(items.includes('Dashboard'));
  assert.ok(items.includes('Settings'));
  assert.ok(!items.includes('Overview'));
  assert.ok(!items.includes('Customers'));
});

test('partner context gets the fleet nav by default — own fleet stays primary', () => {
  const items = titles(resolveNavigation({ type: 'partner' }));
  assert.ok(items.includes('Dashboard'), 'a partner is a fleet operator first');
  assert.ok(!items.includes('Overview'), 'business management is not a peer-level item');
  assert.ok(!items.includes('Customers'), 'business management is not a peer-level item');
});

test('partner context on /saas/partner/* (reached via Settings -> Business) shows business management', () => {
  const items = titles(resolveNavigation({ type: 'partner' }, { inPartnerAdmin: true }));
  assert.ok(items.includes('Overview'));
  assert.ok(items.includes('Customers'));
  assert.ok(!items.includes('Dashboard'), 'business management area is not the fleet');
});

test('platform context always gets the platform nav, regardless of inPartnerAdmin', () => {
  const plain = titles(resolveNavigation({ type: 'platform' }));
  assert.ok(plain.includes('Partners'));
  assert.ok(plain.includes('Direct Customers'));
  assert.ok(!plain.includes('Dashboard'), 'there is no "platform\'s own fleet"');

  // inPartnerAdmin is meaningless for a platform-typed context — platform
  // always wins, there is no ambiguity to resolve via the route the way
  // there is for 'partner' (see navigationResolver.js's header comment).
  const withFlag = titles(resolveNavigation({ type: 'platform' }, { inPartnerAdmin: true }));
  assert.deepEqual(withFlag, plain);
});

test('a dual-capability identity (home company + platform authority) on /saas/platform/* gets the platform nav via inPlatformArea, even though their type is their home type, never \'platform\'', () => {
  // There is no cross-company context switching (see
  // fuel-api/src/services/tenantResolverService.js) — a platform admin who
  // also has a home company NEVER has currentContext.type === 'platform'.
  // Settings -> Platform is a plain link, not a switch, so the route itself
  // (inPlatformArea) is what has to carry this signal.
  const items = titles(resolveNavigation({ type: 'customer' }, { inPlatformArea: true }));
  assert.ok(items.includes('Partners'));
  assert.ok(items.includes('Direct Customers'));
  assert.ok(!items.includes('Dashboard'), 'still shows the platform nav, not the fleet nav, while on a platform-management route');
});

test('inPlatformArea has no effect off /saas/platform/* — a dual-capability identity still gets their own fleet nav everywhere else', () => {
  const items = titles(resolveNavigation({ type: 'customer' }, { inPlatformArea: false }));
  assert.ok(items.includes('Dashboard'));
  assert.ok(!items.includes('Partners'), 'platform-management nav must not leak onto the identity\'s own fleet pages');
});

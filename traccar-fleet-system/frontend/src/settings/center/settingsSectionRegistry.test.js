import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSettingsNavGroups, SETTINGS_SECTION_IDS } from './settingsSectionRegistry.js';

function sectionIds(gates) {
  return buildSettingsNavGroups(gates)
    .flatMap((group) => group.sections)
    .map((section) => section.id);
}

test('a plain customer sees neither Platform nor Business', () => {
  const ids = sectionIds({ manager: true, admin: true });
  assert.ok(!ids.includes(SETTINGS_SECTION_IDS.platformAccess));
  assert.ok(!ids.includes(SETTINGS_SECTION_IDS.businessAccess));
});

test('platform capability shows Platform regardless of the current active context', () => {
  const home = sectionIds({ manager: true, admin: true, platformOwner: true, currentContextType: 'customer' });
  assert.ok(home.includes(SETTINGS_SECTION_IDS.platformAccess));

  const insidePlatform = sectionIds({
    manager: true, admin: true, platformOwner: true, currentContextType: 'platform',
  });
  assert.ok(insidePlatform.includes(SETTINGS_SECTION_IDS.platformAccess));
});

test('Business shows only while the active context is a partner, capability-independent', () => {
  const inPartner = sectionIds({ manager: true, admin: true, currentContextType: 'partner' });
  assert.ok(inPartner.includes(SETTINGS_SECTION_IDS.businessAccess));

  const inCustomer = sectionIds({ manager: true, admin: true, currentContextType: 'customer' });
  assert.ok(!inCustomer.includes(SETTINGS_SECTION_IDS.businessAccess));
});

test('a platform admin whose home company is a partner sees both Platform and Business at once — neither is an upward/downward path from the other, both are this identity\'s own capabilities', () => {
  const ids = sectionIds({
    manager: true, admin: true, platformOwner: true, currentContextType: 'partner',
  });
  assert.ok(ids.includes(SETTINGS_SECTION_IDS.platformAccess));
  assert.ok(ids.includes(SETTINGS_SECTION_IDS.businessAccess));
});

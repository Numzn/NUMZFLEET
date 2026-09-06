import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isGeofenceTrackingEvent, resolveCompanyIdForDevice } from './deviceAudienceResolver.js';
import sequelize, { Company, CompanyDevice } from '../../models/index.js';

describe('isGeofenceTrackingEvent', () => {
  it('matches geofence event types regardless of casing', () => {
    assert.equal(isGeofenceTrackingEvent('geofenceEnter', {}), true);
    assert.equal(isGeofenceTrackingEvent('geofenceenter', {}), true);
    assert.equal(isGeofenceTrackingEvent('GEOFENCEEXIT', {}), true);
  });

  it('matches geofence alarm attribute payloads', () => {
    assert.equal(isGeofenceTrackingEvent('alarm', { alarm: 'geofence' }), true);
    assert.equal(isGeofenceTrackingEvent('alarm', { alarm: 'geofenceExit' }), true);
  });

  it('does not match unrelated events', () => {
    assert.equal(isGeofenceTrackingEvent('overspeed', { alarm: 'sos' }), false);
    assert.equal(isGeofenceTrackingEvent('', {}), false);
  });
});

let dbReachable = false;
try {
  await sequelize.authenticate();
  dbReachable = true;
} catch {
  dbReachable = false;
}

describe('resolveCompanyIdForDevice — tenant isolation for Traccar tracking alarms', { skip: !dbReachable }, () => {
  const TEST_DEVICE_ID = 900301;
  // A real Company row, not DEFAULT_COMPANY_ID — that id is only a real row
  // in environments seeded with "Default Fleet" history (true in dev, false
  // in a fresh CI database), and company_devices.company_id is a real FK.
  let testCompany;

  before(async () => {
    testCompany = await Company.create({
      slug: `device-audience-test-${randomUUID().slice(0, 8)}`,
      name: 'Device Audience Test Co',
      organizationType: 'customer',
      status: 'active',
    });
  });

  after(async () => {
    if (testCompany) await testCompany.destroy();
  });

  it('returns null for a device with no company_devices link (legacy/unprovisioned) rather than throwing', async () => {
    assert.equal(await resolveCompanyIdForDevice(999999), null);
  });

  it('returns null for a null/undefined deviceId', async () => {
    assert.equal(await resolveCompanyIdForDevice(null), null);
    assert.equal(await resolveCompanyIdForDevice(undefined), null);
  });

  it('resolves the real companyId once the device is linked via company_devices', async () => {
    const row = await CompanyDevice.create({
      companyId: testCompany.id,
      traccarDeviceId: TEST_DEVICE_ID,
      isActive: true,
    });
    try {
      const companyId = await resolveCompanyIdForDevice(TEST_DEVICE_ID);
      assert.equal(companyId, testCompany.id);
    } finally {
      await row.destroy();
    }
  });

  it('ignores an inactive company_devices row — same as the rest of the codebase\'s isActive convention', async () => {
    const row = await CompanyDevice.create({
      companyId: testCompany.id,
      traccarDeviceId: TEST_DEVICE_ID,
      isActive: false,
    });
    try {
      assert.equal(await resolveCompanyIdForDevice(TEST_DEVICE_ID), null);
    } finally {
      await row.destroy();
    }
  });
});

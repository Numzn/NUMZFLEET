// Canonical exit targets for pages that used to rely on `navigate(-1)` (browser history), which
// lands wherever history happens to point rather than a defined parent. Each of these is the ONE
// correct parent for that page, regardless of how it was entered — see docs/plans on predictable
// back-navigation for the audit this generalizes from (fleet/vehicleRegistry/vehicleRegistryUtils.js
// already did this for the vehicle workspace family; this covers the rest of the app).

const SETTINGS_LIST_OVERRIDES = {
  maintenance: '/settings/maintenances',
  'attributes/computed': '/settings/attributes',
  geofences: '/geofences',
};

export const settingsListParent = (endpoint) => SETTINGS_LIST_OVERRIDES[endpoint] || `/settings/${endpoint}`;
export const settingsDeviceParent = (deviceId) => `/settings/device/${deviceId}`;
export const settingsGroupParent = (groupId) => `/settings/group/${groupId}`;

export const SETTINGS_HOME = '/settings/preferences';
export const DASHBOARD = '/';
export const LIVE_MAP = '/map';
export const REPORTS_HOME = '/reports/summary';
export const FLEET_VEHICLES = '/fleet/vehicles';
export const LOGIN = '/login';

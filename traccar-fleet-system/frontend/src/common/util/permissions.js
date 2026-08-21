import { useSelector } from 'react-redux';

export const useAdministrator = () => useSelector((state) => {
  const admin = state.session.user.administrator;
  return admin;
});

export const useManager = () => useSelector((state) => {
  const user = state.session.user;
  const admin = user.administrator;
  // Keep frontend manager semantics aligned with fuel-api's roleFlagsFromTraccar
  // (services/userService.js): Traccar's native /api/session response only ever
  // nests this under attributes — a bare top-level user.isManager never actually
  // arrives from Traccar itself, only from fuel-api's own synthetic/bridge user
  // shapes. Checking both here (not just the top-level field) is what makes
  // organizationProvisioningService.js's `attributes: { isManager: true }`
  // convention for a company's first admin actually show up as "manager" in
  // the UI, not just at the API layer.
  const attrManager = user.attributes?.isManager === true || user.attributes?.isManager === 'true';
  const manager = user.isManager === true || attrManager;
  return admin || manager;
});

export const useDeviceReadonly = () => useSelector((state) => {
  const admin = state.session.user.administrator;
  const serverReadonly = state.session.server.readonly;
  const userReadonly = state.session.user.readonly;
  const serverDeviceReadonly = state.session.server.deviceReadonly;
  const userDeviceReadonly = state.session.user.deviceReadonly;
  return !admin && (serverReadonly || userReadonly || serverDeviceReadonly || userDeviceReadonly);
});

export const useRestriction = (key) => useSelector((state) => {
  const admin = state.session.user.administrator;
  const serverValue = state.session.server[key];
  const userValue = state.session.user[key];
  return !admin && (serverValue || userValue);
});

function numzRole(user) {
  const attrs = user?.attributes || {};
  return attrs.numzRole || attrs.numz_role || null;
}

export const useTechnician = () => useSelector((state) => {
  const user = state.session.user;
  if (!user) return false;
  if (user.administrator) return true;
  return numzRole(user) === 'technician';
});

export const useSuperAdmin = () => useSelector((state) => {
  const user = state.session.user;
  return Boolean(user?.administrator && !numzRole(user));
});

export const useDispatcher = () => useSelector((state) => {
  const user = state.session.user;
  return numzRole(user) === 'dispatcher';
});

// Reads the permissions[] the new roles/permissions system resolved for this
// user (see fuel-api/src/permissions/permissionCatalog.js). Additive and
// observational only right now — nothing gates on this yet, existing
// Traccar-flag hooks above remain the enforced checks.
export const usePermission = (key) => useSelector((state) => (
  state.session.user?.permissions?.includes(key) ?? false
));

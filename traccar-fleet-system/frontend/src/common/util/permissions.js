import { useSelector } from 'react-redux';

export const useAdministrator = () => useSelector((state) => {
  const admin = state.session.user.administrator;
  return admin;
});

export const useManager = () => useSelector((state) => {
  const admin = state.session.user.administrator;
  // Keep frontend manager semantics aligned with fuel-api requireManager gate.
  const manager = state.session.user.isManager || false;
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

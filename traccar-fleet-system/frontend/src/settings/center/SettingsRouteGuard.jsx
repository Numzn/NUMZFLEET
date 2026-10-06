import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isSettingsPathAllowed } from './settingsRouteAccess.js';
import useSettingsGates from './useSettingsGates.js';

/**
 * Layout route for everything under /settings. Hiding a sidebar entry is not
 * authorization; this is what stops a manually-typed URL from opening a page the
 * sidebar would not have offered. Denied requests land on the Settings overview.
 */
export default function SettingsRouteGuard() {
  const { pathname } = useLocation();
  const gates = useSettingsGates();

  if (!isSettingsPathAllowed(pathname, gates)) {
    return <Navigate to="/settings" replace />;
  }
  return <Outlet />;
}

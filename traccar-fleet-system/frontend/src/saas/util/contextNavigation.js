import { switchContext } from '../organizationApi';
import { setCurrentContext } from '../../store/organizations';

/**
 * Where a workspace lands once you're in it. Shared by ContextSelector and
 * UnifiedSidebar's "switch workspace" nav group so both entry points agree.
 */
export function landingRouteForContextType(type) {
  if (type === 'platform') return '/saas/platform/overview';
  if (type === 'partner') return '/saas/partner/overview';
  return '/';
}

/**
 * Switch the active context AND navigate to that workspace's natural landing
 * route. A plain link into another context's routes isn't enough on its own:
 * company-scoped reads (vehicles, fuel, etc.) are filtered by the ACTIVE
 * context's companyId, not by identity, so landing on "/" without actually
 * switching would show platform-wide/empty data, not "my fleet." `companyId`
 * is either a real company UUID or the literal string 'platform'.
 */
export async function switchContextAndNavigate({ dispatch, navigate, user, companyId }) {
  // Trust only the backend's response for the new context — see fuel-api's
  // switchActiveContext, the authoritative source.
  const result = await switchContext(user, companyId);
  dispatch(setCurrentContext({
    id: result.companyId,
    name: result.companyName,
    type: result.type,
  }));
  navigate(landingRouteForContextType(result.type));
  return result;
}

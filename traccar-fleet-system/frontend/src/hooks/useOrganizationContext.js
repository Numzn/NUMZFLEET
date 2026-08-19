import { useDispatch } from 'react-redux';
import { useEffectAsync } from '../reactHelper';
import {
  setCurrentContext,
  setAccessibleContexts,
  setPartners,
  setDirectCustomers,
  setOverview,
  setError,
} from '../store/organizations';
import {
  fetchContext,
  fetchPartners,
  fetchDirectCustomers,
  fetchPlatformOverview,
} from '../saas/organizationApi';

/**
 * Hook to initialize organization context on app load.
 *
 * Reads the server's real activeContext/accessibleContexts (GET /api/context)
 * instead of guessing from user.administrator. The old guess
 * (administrator ? 'platform' : 'customer') meant any server-side context
 * switch (e.g. via ContextSelector) was silently reverted on the next full
 * page reload, since this hook re-runs on every mount and never read the
 * server back — see tenantResolverService.js's getHomeContext/resetActiveContext
 * for what the server now considers a user's default context.
 */
export const useOrganizationContext = (user) => {
  const dispatch = useDispatch();

  useEffectAsync(async () => {
    if (!user) {
      return;
    }

    try {
      const { activeContext, accessibleContexts } = await fetchContext(user);

      dispatch(setCurrentContext({
        type: activeContext?.type || 'customer',
        name: activeContext?.companyName || null,
        id: activeContext?.companyId ?? null,
      }));
      dispatch(setAccessibleContexts(accessibleContexts || []));

      if (activeContext?.type === 'platform') {
        const [partners, directCustomers, overview] = await Promise.all([
          fetchPartners(user).catch(() => []),
          fetchDirectCustomers(user).catch(() => []),
          fetchPlatformOverview(user).catch(() => null),
        ]);

        dispatch(setPartners(partners));
        dispatch(setDirectCustomers(directCustomers));
        dispatch(setOverview(overview));
      }
    } catch (err) {
      console.error('Failed to load organization context:', err);
      dispatch(setError(err.message));
    }
  }, [user?.id]);
};

import { useDispatch } from 'react-redux';
import { useEffectAsync } from '../reactHelper';
import {
  setCurrentContext,
  setPartners,
  setDirectCustomers,
  setOverview,
  setError,
} from '../store/organizations';
import {
  fetchPartners,
  fetchDirectCustomers,
  fetchPlatformOverview,
} from '../saas/organizationApi';

/**
 * Hook to initialize organization context on app load
 * Determines user type (Platform/Partner/Customer) and loads appropriate organization data
 */
export const useOrganizationContext = (user) => {
  const dispatch = useDispatch();

  useEffectAsync(async () => {
    if (!user) {
      return;
    }

    try {
      // TODO: Fetch user context from backend (need context endpoint)
      // For now, assume platform admin
      // The backend tenantResolverService.js determines context based on:
      // - req.user.administrator flag
      // - req.auth.activeContext.type ('platform' | 'partner' | 'customer')
      // - req.auth.companyId

      // Placeholder: determine context (this should come from backend auth response)
      const isSuperAdmin = user.administrator || false;
      
      if (isSuperAdmin) {
        // Platform admin context
        dispatch(setCurrentContext({
          type: 'platform',
          name: 'NUMZ Platform',
          id: null,
        }));

        // Load platform data
        const [partners, directCustomers, overview] = await Promise.all([
          fetchPartners(user).catch(() => []),
          fetchDirectCustomers(user).catch(() => []),
          fetchPlatformOverview(user).catch(() => null),
        ]);

        dispatch(setPartners(partners));
        dispatch(setDirectCustomers(directCustomers));
        dispatch(setOverview(overview));
      } else {
        // Partner or customer context
        // TODO: Load from user's companyId
        dispatch(setCurrentContext({
          type: 'customer',
          name: user.attributes?.company || 'My Company',
          id: user.id,
        }));
      }
    } catch (err) {
      console.error('Failed to load organization context:', err);
      dispatch(setError(err.message));
    }
  }, [user?.id]);
};

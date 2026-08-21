import { useDispatch } from 'react-redux';
import { useEffectAsync } from '../reactHelper';
import { setCurrentContext, setHomeCompanyId, setError } from '../store/organizations';
import { fetchContext } from '../saas/organizationApi';

/**
 * Hook to initialize organization context on app load.
 *
 * Reads the server's real activeContext (GET /api/context) instead of
 * guessing from user.administrator. activeContext always equals the
 * identity's own home company (platform only for a genuinely home-less
 * platform-only identity) — there is no cross-company context switching,
 * so unlike the earlier design this never needs to be re-read after the
 * initial load; nothing in the app can change it mid-session.
 */
export const useOrganizationContext = (user) => {
  const dispatch = useDispatch();

  useEffectAsync(async () => {
    if (!user) {
      return;
    }

    try {
      const { activeContext, homeCompanyId } = await fetchContext(user);

      dispatch(setCurrentContext({
        type: activeContext?.type || 'customer',
        name: activeContext?.companyName || null,
        id: activeContext?.companyId ?? null,
      }));
      dispatch(setHomeCompanyId(homeCompanyId ?? null));
    } catch (err) {
      console.error('Failed to load organization context:', err);
      dispatch(setError(err.message));
    }
  }, [user?.id]);
};

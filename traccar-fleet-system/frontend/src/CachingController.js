import { useEffect } from 'react';
import { useDispatch, useSelector, connect } from 'react-redux';
import { traccarPath } from './config/traccarApi.js';
import { fuelApiAuthHeaders } from './config/fuelApiAuth.js';
import {
  geofencesActions, groupsActions, driversActions, maintenancesActions, calendarsActions, fuelRequestsActions,
} from './store';
import { useEffectAsync } from './reactHelper';
import fetchOrThrow from './common/util/fetchOrThrow';
import diag from './common/util/diagLogger';

const FUEL_POLL_INTERVAL_MS = 60000; // 60s fallback poll

const CachingController = () => {
  const authenticated = useSelector((state) => !!state.session.user);
  const user = useSelector((state) => state.session.user);
  const dispatch = useDispatch();

  useEffectAsync(async () => {
    if (authenticated) {
      const response = await fetchOrThrow(traccarPath('/api/geofences'));
      dispatch(geofencesActions.refresh(await response.json()));
    }
  }, [authenticated]);

  useEffectAsync(async () => {
    if (authenticated) {
      const response = await fetchOrThrow(traccarPath('/api/groups'));
      dispatch(groupsActions.refresh(await response.json()));
    }
  }, [authenticated]);

  useEffectAsync(async () => {
    if (authenticated) {
      const response = await fetchOrThrow(traccarPath('/api/drivers'));
      dispatch(driversActions.refresh(await response.json()));
    }
  }, [authenticated]);

  useEffectAsync(async () => {
    if (authenticated) {
      const response = await fetchOrThrow(traccarPath('/api/maintenance'));
      dispatch(maintenancesActions.refresh(await response.json()));
    }
  }, [authenticated]);

  useEffectAsync(async () => {
    if (authenticated) {
      const response = await fetchOrThrow(traccarPath('/api/calendars'));
      dispatch(calendarsActions.refresh(await response.json()));
    }
  }, [authenticated]);

  useEffectAsync(async () => {
    if (authenticated) {
      try {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          return;
        }

        // Fetch fuel requests with credentials to ensure session cookies are sent
        const response = await fetchOrThrow('/api/fuel-requests', {
          credentials: 'include', // Important: sends session cookies
          redirectOnUnauthorized: false, // Background cache refresh must not force global logout
          headers: fuelApiAuthHeaders(user),
        });
        const requests = await response.json();
        diag.log('fuel_requests_loaded', { count: requests.length });

        // Empty list is a valid success state (no rows yet, or driver has none).
        // Log it as a structured diag event in dev only — never as a user-facing error.
        if (requests.length === 0) {
          diag.log('fuel_requests_empty', {
            possibleCauses: ['no_rows', 'driver_has_none', 'auth_mismatch'],
          });
        }

        dispatch(fuelRequestsActions.refresh(requests));
      } catch (error) {
        // Network / server failure: keep last known good data on screen.
        // Wiping the slice would create a misleading "no fuel requests" state
        // during outages, which is exactly what we want to avoid.
        diag.warn('fuel_requests_load_failed', { error: error && error.message });
      }
    }
  }, [authenticated, user?.id]);

  // Fallback poll every 30s — ensures list stays fresh if socket drops
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const fetchFuelRequests = async () => {
      try {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          return;
        }
        const response = await fetch('/api/fuel-requests', {
          credentials: 'include',
          headers: fuelApiAuthHeaders(user),
        });
        if (!response.ok) return;
        const requests = await response.json();
        dispatch(fuelRequestsActions.refresh(requests));
      } catch (_) {
        // silently ignore poll errors
      }
    };

    const timer = setInterval(fetchFuelRequests, FUEL_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [authenticated, user?.id, dispatch]);

  return null;
};

export default connect()(CachingController);

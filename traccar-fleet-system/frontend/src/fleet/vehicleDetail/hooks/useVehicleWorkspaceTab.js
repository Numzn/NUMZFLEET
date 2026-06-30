import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_VEHICLE_WORKSPACE_TAB,
  resolveVehicleWorkspaceTab,
} from '../vehicleWorkspaceTabRegistry.js';

export default function useVehicleWorkspaceTab() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = useMemo(
    () => resolveVehicleWorkspaceTab(searchParams.get('tab')),
    [searchParams],
  );

  const setTab = useCallback((nextTab) => {
    const resolved = resolveVehicleWorkspaceTab(nextTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (resolved === DEFAULT_VEHICLE_WORKSPACE_TAB) {
        next.delete('tab');
      } else {
        next.set('tab', resolved);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return { tab, setTab };
}

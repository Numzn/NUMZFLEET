import {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';

/**
 * Live map workspace contract (`/map`, workspaceType `live`)
 *
 * LiveMapPage registers `{ sidebarFleetProps }` here. UnifiedShell reads it and renders:
 * - LiveMapTopBar — full-width 56px operational chrome (identity, pills, account)
 * - FleetSidebar — rail only (search, filters, vehicle list); no duplicate header/pills
 *
 * Layout (UnifiedShell) — mobile and desktop:
 *   [ LiveMapTopBar — full width ]
 *   [ Fleet rail 280px | 44px collapsed (desktop only) ] [ MainMap via <Outlet /> ]
 *
 * Mobile: fleet list drawer + app nav drawer owned by UnifiedShell (not FleetLayout).
 *
 * Do not reintroduce a second map-only title bar or PremiumTopBar on this route.
 */
const LiveMapChromeContext = createContext({
  chrome: null,
  setLiveMapChrome: () => {},
});

export function LiveMapChromeProvider({ children }) {
  const [chrome, setChromeState] = useState(null);
  const setLiveMapChrome = useCallback((next) => {
    setChromeState(next);
  }, []);

  const value = useMemo(
    () => ({ chrome, setLiveMapChrome }),
    [chrome, setLiveMapChrome],
  );

  return (
    <LiveMapChromeContext.Provider value={value}>
      {children}
    </LiveMapChromeContext.Provider>
  );
}

export function useLiveMapChrome() {
  return useContext(LiveMapChromeContext);
}

import {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';

/**
 * Live map workspace contract (`/map`, workspaceType `live`)
 *
 * LiveMapPage registers `{ sidebarFleetProps }` here. UnifiedShell reads it and renders:
 * - The app shell's own spine (UnifiedSidebar), forced icon-only — the same
 *   permanent rail every other desktop workspace gets, not a live-map-only
 *   concept. See shellChrome.js and UnifiedShell's `forceCollapsed`.
 * - LiveMapTopBar — operational chrome (connection status, pills, account) to
 *   the spine's right, spanning the fleet rail + map columns
 * - FleetSidebar — rail only (search, filters, vehicle list); no header/pills
 *   of its own, no identity block — those live in the spine and LiveMapTopBar
 *
 * Layout (UnifiedShell) — desktop:
 *   [ Spine 56px, own header ] [ LiveMapTopBar — remaining width ]
 *   [ Spine ] [ Fleet rail 280px | 44px collapsed ] [ MainMap via <Outlet /> ]
 *
 * Mobile: fleet list drawer + app nav drawer owned by UnifiedShell (not FleetLayout).
 *
 * Do not reintroduce a second map-only identity block or a "back to
 * dashboard" control on this route — organization identity and the path to
 * every other destination live in the spine now, exactly once, app-wide.
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

import {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';

/**
 * Live map route registers fleet sidebar props with the shell
 * (unified top bar + sidebar render outside <Outlet />).
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

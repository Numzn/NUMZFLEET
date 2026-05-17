import {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';

/**
 * Live map route registers top bar props and fleet sidebar props with the shell
 * (sidebar and top bar render outside <Outlet />).
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

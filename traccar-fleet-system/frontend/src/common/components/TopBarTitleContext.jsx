import {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';

const TopBarTitleContext = createContext({ title: null, setTitle: () => {} });

/** Wraps the shell so any page below it can publish a title into the shared app bar row. */
export function TopBarTitleProvider({ children }) {
  const [title, setTitle] = useState(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);
  return (
    <TopBarTitleContext.Provider value={value}>
      {children}
    </TopBarTitleContext.Provider>
  );
}

export function useTopBarTitle() {
  return useContext(TopBarTitleContext);
}

/** Pages call this to show a title in the shared app-bar row; clears automatically on unmount. */
export function useSetTopBarTitle(title) {
  const { setTitle } = useTopBarTitle();
  useEffect(() => {
    setTitle(title ?? null);
    return () => setTitle(null);
  }, [title, setTitle]);
}

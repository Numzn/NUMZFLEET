import {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';

const EMPTY = { title: null, subtitle: null, actions: null };

const TopBarTitleContext = createContext({ ...EMPTY, setHeader: () => {} });

/**
 * Normalises what a page published into the shape the shell reads.
 *
 * Accepts a bare string so the ten existing `useSetTopBarTitle('Settings')`
 * call sites keep working verbatim; pages that need more pass an object.
 */
function normalize(input) {
  if (input == null) return EMPTY;
  if (typeof input === 'string') return { ...EMPTY, title: input };
  return {
    title: input.title ?? null,
    subtitle: input.subtitle ?? null,
    actions: input.actions ?? null,
  };
}

/** Wraps the shell so any page below it can publish header content into the shared app bar row. */
export function TopBarTitleProvider({ children }) {
  const [header, setHeader] = useState(EMPTY);
  const value = useMemo(() => ({ ...header, setHeader }), [header]);
  return (
    <TopBarTitleContext.Provider value={value}>
      {children}
    </TopBarTitleContext.Provider>
  );
}

export function useTopBarTitle() {
  return useContext(TopBarTitleContext);
}

/**
 * Pages call this to publish header content into the shared app-bar row; clears
 * automatically on unmount. Takes a string or `{ title, subtitle, actions }`.
 */
export function useSetTopBarTitle(input) {
  const { setHeader } = useTopBarTitle();
  // Objects are usually written inline at the call site, so a new identity every
  // render would loop this effect. Depend on the resolved fields instead.
  const { title, subtitle, actions } = normalize(input);
  useEffect(() => {
    setHeader({ title, subtitle, actions });
    return () => setHeader(EMPTY);
  }, [title, subtitle, actions, setHeader]);
}

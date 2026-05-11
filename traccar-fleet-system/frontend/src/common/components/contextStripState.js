import { createContext, useContext } from 'react';

const ContextStripStateContext = createContext({ enabled: false });

export const ContextStripStateProvider = ContextStripStateContext.Provider;

export const useContextStripState = () => useContext(ContextStripStateContext);


import React, { createContext, useContext, useCallback } from 'react';
import { useLocation } from 'wouter';

interface NavigationContextType {
  currentPath: string;
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const navigate = useCallback((path: string) => {
    if (path === location) return;
    setLocation(path);
  }, [location, setLocation]);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  const goForward = useCallback(() => {
    window.history.forward();
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        currentPath: location,
        navigate,
        goBack,
        goForward,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

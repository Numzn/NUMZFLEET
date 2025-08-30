import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';

interface NavigationContextType {
  currentPath: string;
  previousPath: string | null;
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  isNavigating: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [previousPath, setPreviousPath] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track navigation history
  useEffect(() => {
    if (location !== navigationHistory[currentIndex]) {
      const newHistory = navigationHistory.slice(0, currentIndex + 1);
      newHistory.push(location);
      setNavigationHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      
      if (previousPath !== location) {
        setPreviousPath(previousPath);
      }
    }
  }, [location, navigationHistory, currentIndex, previousPath]);

  const navigate = useCallback((path: string) => {
    if (path === location) return;
    
    setIsNavigating(true);
    setPreviousPath(location);
    setLocation(path);
    
    // Reset navigation state after a short delay
    setTimeout(() => setIsNavigating(false), 100);
  }, [location, setLocation]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const targetPath = navigationHistory[newIndex];
      setCurrentIndex(newIndex);
      setPreviousPath(location);
      setLocation(targetPath);
      setIsNavigating(true);
      setTimeout(() => setIsNavigating(false), 100);
    } else {
      window.history.back();
    }
  }, [currentIndex, navigationHistory, location, setLocation]);

  const goForward = useCallback(() => {
    if (currentIndex < navigationHistory.length - 1) {
      const newIndex = currentIndex + 1;
      const targetPath = navigationHistory[newIndex];
      setCurrentIndex(newIndex);
      setPreviousPath(location);
      setLocation(targetPath);
      setIsNavigating(true);
      setTimeout(() => setIsNavigating(false), 100);
    } else {
      window.history.forward();
    }
  }, [currentIndex, navigationHistory, location, setLocation]);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < navigationHistory.length - 1;

  return (
    <NavigationContext.Provider
      value={{
        currentPath: location,
        previousPath,
        navigate,
        goBack,
        goForward,
        canGoBack,
        canGoForward,
        isNavigating,
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

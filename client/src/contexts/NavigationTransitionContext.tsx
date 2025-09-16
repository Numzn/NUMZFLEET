import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';

interface NavigationTransitionContextType {
  navigationDirection: 'forward' | 'backward' | 'none';
  setNavigationDirection: (direction: 'forward' | 'backward' | 'none') => void;
  previousPath: string | null;
}

const NavigationTransitionContext = createContext<NavigationTransitionContextType | undefined>(undefined);

export function NavigationTransitionProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [navigationDirection, setNavigationDirection] = useState<'forward' | 'backward' | 'none'>('none');
  const [previousPath, setPreviousPath] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  useEffect(() => {
    if (previousPath && previousPath !== location) {
      // Simple direction detection - if we're going to a new path, it's forward
      // This is a simplified approach that avoids the infinite loop
      setNavigationDirection('forward');
      
      // Reset direction after a short delay
      setTimeout(() => {
        setNavigationDirection('none');
      }, 600);
    }
    
    // Update path history
    setPathHistory(prev => {
      const newHistory = [...prev];
      if (!newHistory.includes(location)) {
        newHistory.push(location);
      }
      return newHistory;
    });
    
    setPreviousPath(location);
  }, [location]); // Only depend on location changes

  return (
    <NavigationTransitionContext.Provider value={{ 
      navigationDirection, 
      setNavigationDirection, 
      previousPath 
    }}>
      {children}
    </NavigationTransitionContext.Provider>
  );
}

export function useNavigationTransition() {
  const context = useContext(NavigationTransitionContext);
  if (context === undefined) {
    throw new Error('useNavigationTransition must be used within a NavigationTransitionProvider');
  }
  return context;
}


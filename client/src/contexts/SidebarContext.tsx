import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';

interface SidebarContextType {
  isCollapsed: boolean;
  isHidden: boolean;
  isAutoCollapsing: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setHidden: (hidden: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : true; // Start collapsed by default
  });
  const [isHidden, setIsHidden] = useState(false);
  const [isAutoCollapsing, setIsAutoCollapsing] = useState(false);
  const [previousLocation, setPreviousLocation] = useState(location);

  // Auto-hide sidebar on tracking page
  useEffect(() => {
    const isTrackingPage = location === '/tracking';
    setIsHidden(isTrackingPage);
  }, [location]);

  // Auto-collapse sidebar after navigation (except on tracking page)
  useEffect(() => {
    const isTrackingPage = location === '/tracking';
    const hasNavigated = previousLocation !== location;
    
    if (!isTrackingPage && hasNavigated) {
      // Show auto-collapsing indicator
      setIsAutoCollapsing(true);
      
      // Small delay to allow navigation animation to complete
      const timer = setTimeout(() => {
        setIsCollapsed(true);
        // Reset auto-collapsing indicator after animation
        setTimeout(() => setIsAutoCollapsing(false), 300);
      }, 300); // Slightly longer delay for smoother UX
      
      return () => clearTimeout(timer);
    }
    
    setPreviousLocation(location);
  }, [location, previousLocation]);

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  const setCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
  };

  const setHidden = (hidden: boolean) => {
    setIsHidden(hidden);
  };

  // Save preference to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, isHidden, isAutoCollapsing, toggleSidebar, setCollapsed, setHidden }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

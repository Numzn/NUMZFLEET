import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface SimplePageTransitionProps {
  children: React.ReactNode;
  className?: string;
  transitionType?: 'fade' | 'slide' | 'shift';
}

export function SimplePageTransition({ 
  children, 
  className, 
  transitionType = 'shift' 
}: SimplePageTransitionProps) {
  const [location] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(location);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    if (currentLocation !== location) {
      // Location changed, start transition
      setIsVisible(false);
      
      // Randomly determine slide direction for variety
      setSlideDirection(Math.random() > 0.5 ? 'right' : 'left');
      
      const timer = setTimeout(() => {
        setCurrentLocation(location);
        setIsVisible(true);
      }, 150);

      return () => clearTimeout(timer);
    } else {
      // Initial load
      setIsVisible(true);
    }
  }, [location, currentLocation]);

  const getTransitionClasses = () => {
    const baseClasses = "transition-all duration-500 ease-in-out";
    
    switch (transitionType) {
      case 'fade':
        return cn(
          baseClasses,
          isVisible 
            ? "opacity-100" 
            : "opacity-0"
        );
      
      case 'slide':
        return cn(
          baseClasses,
          isVisible 
            ? "opacity-100 translate-y-0" 
            : "opacity-0 translate-y-4"
        );
      
      case 'shift':
        return cn(
          baseClasses,
          isVisible 
            ? "opacity-100 translate-x-0 translate-y-0" 
            : cn(
                "opacity-0",
                slideDirection === 'right' 
                  ? "translate-x-8 translate-y-2" 
                  : "-translate-x-8 translate-y-2"
              )
        );
      
      default:
        return baseClasses;
    }
  };

  return (
    <div
      className={cn(
        getTransitionClasses(),
        className
      )}
    >
      {children}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useNavigationTransition } from '@/contexts/NavigationTransitionContext';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  transitionType?: 'fade' | 'slide' | 'scale' | 'shift' | 'stack' | 'none';
  direction?: 'left' | 'right' | 'up' | 'down';
}

export function PageTransition({ 
  children, 
  className, 
  transitionType = 'shift',
  direction = 'right'
}: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'in' | 'out'>('in');
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const prevChildrenRef = useRef(children);
  const [pageStack, setPageStack] = useState<React.ReactNode[]>([]);
  const { navigationDirection } = useNavigationTransition();

  useEffect(() => {
    // Check if children have changed (new page)
    const hasChanged = prevChildrenRef.current !== children;
    
    if (hasChanged) {
      // Determine slide direction based on navigation direction
      const newDirection = navigationDirection === 'backward' ? 'left' : 'right';
      setSlideDirection(newDirection);
      
      // Start transition out
      setIsTransitioning(true);
      setTransitionDirection('out');
      setIsVisible(false);
      
      // Add current page to stack for stack effect
      if (transitionType === 'stack') {
        setPageStack(prev => [...prev, prevChildrenRef.current]);
      }
      
      const outTimer = setTimeout(() => {
        // Start transition in
        setTransitionDirection('in');
        setIsVisible(true);
        
        const inTimer = setTimeout(() => {
          setIsTransitioning(false);
          // Clean up stack after transition
          if (transitionType === 'stack') {
            setTimeout(() => {
              setPageStack(prev => prev.slice(0, -1));
            }, 100);
          }
        }, 50);
        
        return () => clearTimeout(inTimer);
      }, 150);

      prevChildrenRef.current = children;
      return () => clearTimeout(outTimer);
    } else {
      // Initial load
      setIsTransitioning(true);
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsVisible(true);
        setIsTransitioning(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [children, transitionType, navigationDirection]);

  const getTransitionClasses = () => {
    if (transitionType === 'none') return '';
    
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
            : "opacity-0 translate-y-8"
        );
      
      case 'scale':
        return cn(
          baseClasses,
          isVisible 
            ? "opacity-100 scale-100" 
            : "opacity-0 scale-95"
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
      
      case 'stack':
        return cn(
          baseClasses,
          isVisible 
            ? "opacity-100 translate-x-0 translate-y-0 scale-100" 
            : "opacity-0 translate-x-4 translate-y-4 scale-95"
        );
      
      default:
        return baseClasses;
    }
  };

  const getStackClasses = (index: number) => {
    const offset = (pageStack.length - index) * 4;
    const scale = 1 - (pageStack.length - index) * 0.02;
    const opacity = 1 - (pageStack.length - index) * 0.1;
    
    return cn(
      "absolute inset-0 transition-all duration-500 ease-in-out",
      "bg-background rounded-lg shadow-lg",
      `translate-x-${offset} translate-y-${offset}`,
      `scale-[${scale}]`,
      `opacity-${Math.round(opacity * 100)}`
    );
  };

  if (transitionType === 'stack' && pageStack.length > 0) {
    return (
      <div className={cn("relative", className)}>
        {/* Render stacked pages */}
        {pageStack.map((page, index) => (
          <div key={index} className={getStackClasses(index)}>
            {page}
          </div>
        ))}
        
        {/* Current page */}
        <div
          className={cn(
            getTransitionClasses(),
            isTransitioning && "pointer-events-none",
            "relative z-10"
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        getTransitionClasses(),
        isTransitioning && "pointer-events-none",
        className
      )}
    >
      {children}
    </div>
  );
}

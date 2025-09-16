import React from 'react';
import { Fuel, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/SidebarContext';
import { useLocation } from 'wouter';

interface SidebarHeaderProps {
  className?: string;
}

export function SidebarHeader({ className }: SidebarHeaderProps) {
  const { isCollapsed, toggleSidebar, isHidden, setHidden } = useSidebar();
  const [location] = useLocation();
  const isTrackingPage = location === '/tracking';

  return (
    <div className={cn(
      "flex h-16 items-center border-b px-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50",
      "transition-all duration-300 ease-in-out",
      className
    )}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="relative flex-shrink-0">
            <Fuel className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div className="absolute inset-0 bg-blue-400 rounded-full blur-sm opacity-30 animate-pulse"></div>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 transition-all duration-300 ease-in-out">
              <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">
                NumzFleet
              </span>
              <span className="text-xs text-muted-foreground truncate">Fleet Management</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Hide sidebar button - Only show on tracking page */}
          {isTrackingPage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHidden(true)}
              className="h-8 w-8 p-0 hover:bg-accent/50 transition-all duration-200"
              title="Hide sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          
          {/* Collapse/Expand button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn(
              "h-8 w-8 p-0 hover:bg-accent/50 transition-all duration-200",
              "opacity-0 group-hover:opacity-100",
              isCollapsed && "opacity-100"
            )}
          >
            {isCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}



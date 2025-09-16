import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { SyncStatusIndicator } from '@/components/data-sync/SyncStatusIndicator';
import { useNavigation } from '@/contexts/NavigationContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { NAV_ITEMS } from '@/lib/routing';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';

interface SidebarNavProps {
  className?: string;
}

export function SidebarNav({ className }: SidebarNavProps) {
  const { currentPath, navigate } = useNavigation();
  const { isCollapsed } = useSidebar();
  const [isNavigating, setIsNavigating] = useState(false);

  // For now, show all items. Admin filtering can be added later
  const filteredNavItems = NAV_ITEMS;

  const handleNavigation = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    // Don't navigate if already on the same page
    if (currentPath === href) return;
    
    // Add a subtle click animation and loading state
    const button = e.currentTarget;
    if (button instanceof HTMLButtonElement) {
      button.style.transform = 'scale(0.95)';
    }
    setIsNavigating(true);
    
    setTimeout(() => {
      if (button instanceof HTMLButtonElement) {
        button.style.transform = '';
      }
      navigate(href);
      
      // Reset loading state after navigation
      setTimeout(() => {
        setIsNavigating(false);
      }, 300);
    }, 100);
  };

  return (
    <div className={cn("flex-1 overflow-auto py-4", className)}>
      <nav className="space-y-1 px-2">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          
          const navButton = (
            <button
              key={item.href}
              onClick={(e) => handleNavigation(item.href, e)}
              disabled={isNavigating}
              className={cn(
                "group flex items-center rounded-lg text-sm font-medium transition-all duration-300 w-full text-left",
                "hover:bg-accent hover:text-accent-foreground hover:shadow-md hover:scale-[1.02]",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-accent",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]"
                  : "text-muted-foreground",
                isCollapsed ? "px-2 py-3 justify-center" : "px-3 py-2.5 space-x-3"
              )}
            >
              <div className={cn(
                "flex items-center justify-center rounded-md transition-all duration-300",
                "group-hover:scale-110 group-hover:rotate-3",
                isActive 
                  ? "bg-primary-foreground/20 shadow-sm" 
                  : "bg-muted group-hover:bg-accent-foreground/20 group-hover:shadow-sm",
                isCollapsed ? "w-10 h-10" : "w-8 h-8"
              )}>
                {isNavigating && isActive ? (
                  <Loader2 className={cn(
                    "animate-spin transition-all duration-300",
                    isCollapsed ? "h-5 w-5" : "h-4 w-4",
                    "text-primary-foreground"
                  )} />
                ) : (
                  <Icon className={cn(
                    "transition-all duration-300",
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground",
                    isCollapsed ? "h-5 w-5" : "h-4 w-4"
                  )} />
                )}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className={cn(
                      "text-xs truncate transition-colors duration-300",
                      isActive ? "text-primary-foreground/70" : "text-muted-foreground/70 group-hover:text-accent-foreground/70"
                    )}>
                      {item.description}
                    </p>
                  )}
                </div>
              )}
            </button>
          );

          if (isCollapsed) {
            return (
              <TooltipProvider key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {navButton}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="ml-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground">{item.description}</span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return navButton;
        })}
      </nav>
      
      {/* Sync Status Section */}
      {!isCollapsed && (
        <div className="mt-6 px-2">
          <div className="rounded-lg border bg-card/50 p-3 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-muted-foreground">GPS Status</h3>
            </div>
            <SyncStatusIndicator />
          </div>
        </div>
      )}
    </div>
  );
}



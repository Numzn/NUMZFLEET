import React from 'react';
import { ChevronLeft, ChevronRight, Home, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
import { NAV_ITEMS } from '@/lib/routing';
import { cn } from '@/lib/utils';
import { DeviceSelector } from '@/components/tracking/controls/DeviceSelector';
import { MapControls } from '@/components/tracking/controls/MapControls';
interface NavigationHeaderProps {
  // Live map controls props
  traccarDevices?: any[];
  selectedDeviceId?: number | undefined;
  onDeviceSelect?: (deviceId: number | undefined) => void;
  onDeviceSelectObject?: (device: any) => void;
  selectedDevice?: any;
  traccarLoading?: boolean;
  onFullscreen?: () => void;
  onOpenExternal?: () => void;
  isFullscreen?: boolean;
}

export function NavigationHeader({
  traccarDevices = [],
  selectedDeviceId = undefined,
  onDeviceSelect,
  onDeviceSelectObject,
  selectedDevice,
  traccarLoading = false,
  onFullscreen,
  onOpenExternal,
  isFullscreen = false
}: NavigationHeaderProps) {
  const { currentPath, navigate, goBack, goForward } = useNavigation();
  const { isHidden, setHidden } = useSidebar();

  // Get current page info
  const currentPage = NAV_ITEMS.find(item => item.href === currentPath) || {
    label: 'Unknown Page',
    href: currentPath,
  };

  // Build breadcrumb path
  const breadcrumbs = [
    { label: 'Home', href: '/', icon: Home },
    ...(currentPath !== '/' ? [{ label: currentPage.label, href: currentPath }] : []),
  ];

  const isTrackingPage = currentPath === '/tracking';

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 navigation-header">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Sidebar Toggle - Only show on tracking page when sidebar is hidden */}
        {isTrackingPage && isHidden && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHidden(false)}
            className="h-8 w-8 p-0"
            title="Show sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goBack}
            className="h-8 w-8 p-0"
            title="Go back"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goForward}
            className="h-8 w-8 p-0"
            title="Go forward"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const Icon = 'icon' in crumb ? crumb.icon : null;
            
            return (
              <div key={crumb.href} className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                {isLast ? (
                  <span className="font-medium text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    onClick={() => navigate(crumb.href)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </button>
                )}
                {!isLast && (
                  <span className="text-muted-foreground">/</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Live Map Controls - Only show on tracking page */}
        {isTrackingPage && (
          <div className="flex items-center gap-2 ml-4">
            <DeviceSelector
              devices={traccarDevices}
              selectedDeviceId={selectedDeviceId}
              onDeviceSelect={onDeviceSelect || (() => {})}
            />
          </div>
        )}

        {/* Live Map Controls - Right side */}
        {isTrackingPage && (
          <div className="ml-auto flex items-center gap-2">
            {/* Subtle background update indicator */}
            {traccarLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span>Updating...</span>
              </div>
            )}
            <MapControls
              selectedDevice={selectedDevice}
              onFullscreen={onFullscreen || (() => {})}
              onOpenExternal={onOpenExternal || (() => {})}
              isFullscreen={isFullscreen}
            />
          </div>
        )}
      </div>
    </div>
  );
}

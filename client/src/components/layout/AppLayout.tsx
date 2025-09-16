import React from 'react';
import { useLocation } from 'wouter';
import { Sidebar } from '@/components/navbar';
import { NavigationHeader } from './NavigationHeader';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { PageTransition } from '@/components/ui/PageTransition';
import { SimplePageTransition } from '@/components/ui/SimplePageTransition';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
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

function AppLayoutContent({ 
  children,
  traccarDevices = [],
  selectedDeviceId = undefined,
  onDeviceSelect,
  onDeviceSelectObject,
  selectedDevice,
  traccarLoading = false,
  onFullscreen,
  onOpenExternal,
  isFullscreen = false
}: React.PropsWithChildren<AppLayoutProps>) {
  const [location] = useLocation();
  const { isCollapsed, isHidden } = useSidebar();
  
  // Check if current page is tracking page for full-width layout
  const isTrackingPage = location === '/tracking';
  
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
        isHidden ? "w-full" : "flex-1 w-full"
      )}>
        {/* Navigation Header */}
        <NavigationHeader
          traccarDevices={traccarDevices}
          selectedDeviceId={selectedDeviceId}
          onDeviceSelect={onDeviceSelect}
          onDeviceSelectObject={onDeviceSelectObject}
          selectedDevice={selectedDevice}
          traccarLoading={traccarLoading}
          onFullscreen={onFullscreen}
          onOpenExternal={onOpenExternal}
          isFullscreen={isFullscreen}
        />
        
        {/* Main Content Area */}
        <main className={`flex-1 ${isTrackingPage ? 'overflow-hidden p-0' : 'overflow-auto p-6 lg:p-8'}`}>
          {isTrackingPage ? (
            // No transition for tracking page
            <div className="w-full h-full">
              {children}
            </div>
          ) : (
            // Simple transition for other pages
            <SimplePageTransition 
              transitionType="shift"
              className="h-full"
            >
              <div className="max-w-7xl mx-auto">
                {children}
              </div>
            </SimplePageTransition>
          )}
        </main>
      </div>
    </div>
  );
}

export function AppLayout(props: React.PropsWithChildren<AppLayoutProps>) {
  return (
    <SidebarProvider>
      <AppLayoutContent {...props} />
    </SidebarProvider>
  );
}



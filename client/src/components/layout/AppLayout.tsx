import React from 'react';
import { Sidebar } from '@/components/navbar';
import { NavigationHeader } from './NavigationHeader';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: React.PropsWithChildren<AppLayoutProps>) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navigation Header */}
        <NavigationHeader />
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}



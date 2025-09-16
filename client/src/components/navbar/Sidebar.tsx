import React from 'react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/SidebarContext';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter } from './SidebarFooter';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { isCollapsed, isHidden, isAutoCollapsing } = useSidebar();

  if (isHidden) {
    return null;
  }

  return (
    <div className={cn(
      "flex h-screen flex-col border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      "shadow-lg transition-all duration-300 ease-in-out",
      isCollapsed ? "w-16" : "w-64",
      isAutoCollapsing && "opacity-90 scale-[0.98]",
      className
    )}>
      <SidebarHeader />
      <SidebarNav />
      <SidebarFooter />
    </div>
  );
}



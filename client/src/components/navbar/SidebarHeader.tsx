import React from 'react';
import { Fuel } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
  className?: string;
}

export function SidebarHeader({ className }: SidebarHeaderProps) {
  return (
    <div className={cn(
      "flex h-16 items-center border-b px-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50",
      className
    )}>
      <div className="flex items-center space-x-3">
        <div className="relative">
          <Fuel className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <div className="absolute inset-0 bg-blue-400 rounded-full blur-sm opacity-30 animate-pulse"></div>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            NumzFleet
          </span>
          <span className="text-xs text-muted-foreground">Fleet Management</span>
        </div>
      </div>
    </div>
  );
}



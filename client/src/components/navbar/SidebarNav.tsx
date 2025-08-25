import React from 'react';
import { Calendar, Car, BarChart, TrendingUp, MapPin, Shield, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { SyncStatusIndicator } from '@/components/data-sync/SyncStatusIndicator';

interface SidebarNavProps {
  className?: string;
}

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  adminOnly?: boolean;
  description?: string;
}

const navItems: NavItem[] = [
  {
    href: '/',
    icon: Calendar,
    label: 'Dashboard',
    description: 'Overview and metrics',
  },
  {
    href: '/vehicles',
    icon: Car,
    label: 'Vehicle Management',
    description: 'Manage fleet vehicles',
  },
  {
    href: '/reports',
    icon: BarChart,
    label: 'Reports',
    description: 'Generate reports',
  },
  {
    href: '/analytics',
    icon: TrendingUp,
    label: 'Analytics',
    description: 'Data insights',
  },
  {
    href: '/tracking',
    icon: MapPin,
    label: 'Live Tracking',
    description: 'GPS tracking',
  },
  {
    href: '/traccar-admin',
    icon: Shield,
    label: 'GPS Admin',
    description: 'Device management',
    adminOnly: true,
  },
  {
    href: '/settings',
    icon: Settings,
    label: 'Settings',
    description: 'System configuration',
  },
];

export function SidebarNav({ className }: SidebarNavProps) {
  const { isOwner } = useAuth();
  const currentPath = window.location.pathname;

  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || isOwner
  );

  return (
    <div className={cn("flex-1 overflow-auto py-4", className)}>
      <nav className="space-y-1 px-4">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center space-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                isActive 
                  ? "bg-primary-foreground/20" 
                  : "bg-muted group-hover:bg-accent-foreground/20"
              )}>
                <Icon className={cn(
                  "h-4 w-4 transition-colors",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className={cn(
                    "text-xs truncate transition-colors",
                    isActive ? "text-primary-foreground/70" : "text-muted-foreground/70 group-hover:text-accent-foreground/70"
                  )}>
                    {item.description}
                  </p>
                )}
              </div>
            </a>
          );
        })}
      </nav>
      
      {/* Sync Status Section */}
      <div className="mt-6 px-4">
        <div className="rounded-lg border bg-card/50 p-2 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-muted-foreground">GPS Status</h3>
          </div>
          <SyncStatusIndicator />
        </div>
      </div>
    </div>
  );
}



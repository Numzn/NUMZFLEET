import { Calendar, Car, BarChart, TrendingUp, MapPin, Shield, Settings } from 'lucide-react';

// Route configuration
export const ROUTES = {
  HOME: '/',
  VEHICLES: '/vehicles',
  TRACKING: '/tracking',
  TRACCAR_ADMIN: '/traccar-admin',
  REPORTS: '/reports',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
  LOGIN: '/login',
  MAP_TEST: '/map-test',
} as const;

// Navigation items configuration with icons
export const NAV_ITEMS = [
  {
    href: ROUTES.HOME,
    label: 'Dashboard',
    description: 'Overview and metrics',
    icon: Calendar,
    adminOnly: false,
    badge: undefined,
  },
  {
    href: ROUTES.VEHICLES,
    label: 'Vehicle Management',
    description: 'Manage fleet vehicles',
    icon: Car,
    adminOnly: false,
    badge: undefined,
  },
  {
    href: ROUTES.REPORTS,
    label: 'Reports',
    description: 'Generate reports',
    icon: BarChart,
    adminOnly: false,
    badge: undefined,
  },
  {
    href: ROUTES.ANALYTICS,
    label: 'Analytics',
    description: 'Data insights',
    icon: TrendingUp,
    adminOnly: false,
    badge: undefined,
  },
  {
    href: ROUTES.TRACKING,
    label: 'Live Tracking',
    description: 'GPS tracking',
    icon: MapPin,
    adminOnly: false,
    badge: undefined,
  },
  {
    href: ROUTES.TRACCAR_ADMIN,
    label: 'GPS Admin',
    description: 'Device management',
    icon: Shield,
    adminOnly: true,
    badge: undefined,
  },
  {
    href: ROUTES.SETTINGS,
    label: 'Settings',
    description: 'System configuration',
    icon: Settings,
    adminOnly: false,
    badge: undefined,
  },
] as const;

// Route guard hook
export function useRouteGuard(requiredAuth: boolean = true) {
  // Add any route-specific logic here
  // For example, checking permissions, redirecting, etc.
  
  return {
    canAccess: true, // Add your logic here
    redirectTo: null, // Add redirect logic if needed
  };
}

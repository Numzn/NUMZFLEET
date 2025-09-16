// Application routing configuration
export const ROUTES = {
  HOME: '/',
  MAP: '/map',
  REPORTS: '/reports',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  VEHICLES: '/vehicles',
  DRIVERS: '/drivers',
  FUEL: '/fuel',
  MAINTENANCE: '/maintenance',
  EXPORTS: '/exports',
  ADMIN: '/admin'
} as const;

// Navigation items for sidebar
export const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: ROUTES.DASHBOARD,
    icon: 'Home',
    description: 'Overview and key metrics'
  },
  {
    label: 'Map View',
    href: ROUTES.MAP,
    icon: 'MapPin',
    description: 'Live tracking and historical replay analysis'
  },
  {
    label: 'Reports',
    href: ROUTES.REPORTS,
    icon: 'FileText',
    description: 'Generate and view reports'
  },
  {
    label: 'Analytics',
    href: ROUTES.ANALYTICS,
    icon: 'BarChart3',
    description: 'Data analysis and insights'
  },
  {
    label: 'Vehicles',
    href: ROUTES.VEHICLES,
    icon: 'Truck',
    description: 'Manage vehicle fleet'
  },
  {
    label: 'Drivers',
    href: ROUTES.DRIVERS,
    icon: 'Users',
    description: 'Driver management'
  },
  {
    label: 'Fuel Records',
    href: ROUTES.FUEL,
    icon: 'Fuel',
    description: 'Fuel consumption tracking'
  },
  {
    label: 'Maintenance',
    href: ROUTES.MAINTENANCE,
    icon: 'Wrench',
    description: 'Vehicle maintenance logs'
  },
  {
    label: 'Exports',
    href: ROUTES.EXPORTS,
    icon: 'Download',
    description: 'Export data and reports'
  },
  {
    label: 'Settings',
    href: ROUTES.SETTINGS,
    icon: 'Settings',
    description: 'Application settings'
  }
] as const;

// Page titles mapping
export const PAGE_TITLES = {
  [ROUTES.HOME]: 'Home',
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.MAP]: 'Map View',
  [ROUTES.REPORTS]: 'Reports',
  [ROUTES.ANALYTICS]: 'Analytics',
  [ROUTES.VEHICLES]: 'Vehicles',
  [ROUTES.DRIVERS]: 'Drivers',
  [ROUTES.FUEL]: 'Fuel Records',
  [ROUTES.MAINTENANCE]: 'Maintenance',
  [ROUTES.EXPORTS]: 'Exports',
  [ROUTES.SETTINGS]: 'Settings',
  [ROUTES.LOGIN]: 'Login',
  [ROUTES.REGISTER]: 'Register',
  [ROUTES.ADMIN]: 'Admin'
} as const;

// Helper function to get page title
export const getPageTitle = (path: string): string => {
  return PAGE_TITLES[path as keyof typeof PAGE_TITLES] || 'Unknown Page';
};

// Helper function to check if route is active
export const isActiveRoute = (currentPath: string, targetPath: string): boolean => {
  if (targetPath === ROUTES.HOME) {
    return currentPath === ROUTES.HOME;
  }
  return currentPath.startsWith(targetPath);
};

// Helper function to get navigation item by path
export const getNavItemByPath = (path: string) => {
  return NAV_ITEMS.find(item => item.href === path);
};

// Helper function to get breadcrumbs
export const getBreadcrumbs = (currentPath: string) => {
  const breadcrumbs = [];
  
  // Always start with home
  breadcrumbs.push({
    label: 'Home',
    href: ROUTES.HOME,
    icon: 'Home'
  });
  
  // Add current page if not home
  if (currentPath !== ROUTES.HOME) {
    const currentItem = getNavItemByPath(currentPath);
    if (currentItem) {
      breadcrumbs.push({
        label: currentItem.label,
        href: currentItem.href,
        icon: currentItem.icon
      });
    }
  }
  
  return breadcrumbs;
};
import React from 'react';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/NavigationContext';
import { NAV_ITEMS } from '@/lib/routing';
import { cn } from '@/lib/utils';

export function NavigationHeader() {
  const { currentPath, navigate, goBack, goForward } = useNavigation();

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

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-6">
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

        {/* Page Title */}
        <div className="ml-auto">
          <h1 className="text-lg font-semibold text-foreground">
            {currentPage.label}
          </h1>
        </div>
      </div>
    </div>
  );
}

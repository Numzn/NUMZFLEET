import React from 'react';
import { Moon, Sun, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';

interface SidebarFooterProps {
  className?: string;
}

export function SidebarFooter({ className }: SidebarFooterProps) {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { isCollapsed } = useSidebar();
  
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const userButton = (
    <Button 
      variant="ghost" 
      className={cn(
        "w-full h-auto transition-all duration-300 hover:bg-accent hover:shadow-md",
        isCollapsed ? "p-2 justify-center" : "p-3 justify-start"
      )}
    >
      <div className={cn(
        "flex items-center w-full transition-all duration-300",
        isCollapsed ? "justify-center" : "space-x-3"
      )}>
        <div className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 transition-all duration-300",
          "group-hover:scale-110 group-hover:rotate-3",
          isCollapsed ? "w-8 h-8" : "w-8 h-8"
        )}>
          <User className={cn(
            "text-primary transition-all duration-300",
            isCollapsed ? "h-4 w-4" : "h-4 w-4"
          )} />
        </div>
        {!isCollapsed && (
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium truncate">{user?.email || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">Signed in</p>
          </div>
        )}
      </div>
    </Button>
  );

  const themeButton = (
    <Button 
      variant="ghost" 
      size="sm" 
      className={cn(
        "w-full transition-all duration-300 hover:bg-accent hover:shadow-md",
        isCollapsed ? "p-2 justify-center" : "justify-start h-auto p-2"
      )}
      onClick={toggleTheme}
    >
      <div className={cn(
        "flex items-center w-full transition-all duration-300",
        isCollapsed ? "justify-center" : "space-x-3"
      )}>
        <div className={cn(
          "flex items-center justify-center rounded-md bg-muted transition-all duration-300",
          "group-hover:scale-110 group-hover:rotate-3",
          isCollapsed ? "w-8 h-8" : "w-6 h-6"
        )}>
          {theme === "dark" ? (
            <Sun className={cn(
              "transition-all duration-300",
              isCollapsed ? "h-4 w-4" : "h-3 w-3"
            )} />
          ) : (
            <Moon className={cn(
              "transition-all duration-300",
              isCollapsed ? "h-4 w-4" : "h-3 w-3"
            )} />
          )}
        </div>
        {!isCollapsed && (
          <span className="text-sm font-medium">
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        )}
      </div>
    </Button>
  );

  return (
    <div className={cn(
      "border-t bg-muted/30 p-2 space-y-2 transition-all duration-300",
      className
    )}>
      {/* User Profile */}
      {isCollapsed ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  {userButton}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">Signed in</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/settings" className="flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Settings
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <div className="flex flex-col">
                <span className="font-medium">{user?.email || 'User'}</span>
                <span className="text-xs text-muted-foreground">Signed in</span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {userButton}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.email}</p>
                <p className="text-xs leading-none text-muted-foreground">Signed in</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/settings" className="flex items-center">
                <User className="h-4 w-4 mr-2" />
                Settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Theme Toggle */}
      {isCollapsed ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {themeButton}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <span className="font-medium">
                {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        themeButton
      )}
    </div>
  );
}



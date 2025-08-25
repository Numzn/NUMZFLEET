import React from 'react';
import { Moon, Sun, User, LogOut, Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface SidebarFooterProps {
  className?: string;
}

export function SidebarFooter({ className }: SidebarFooterProps) {
  const { theme, setTheme } = useTheme();
  const { adminUser, logout, clearSession, isOwner } = useAuth();
  
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleClearSession = async () => {
    try {
      await clearSession();
    } catch (error) {
      console.error('Clear session failed:', error);
    }
  };

  return (
    <div className={cn("border-t bg-muted/30 p-4", className)}>
      {/* User Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-start h-auto p-3 hover:bg-accent">
            <div className="flex items-center space-x-3 w-full">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{adminUser?.name || 'Admin'}</p>
                <p className="text-xs text-muted-foreground truncate">{adminUser?.email}</p>
              </div>
              {isOwner && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  <Shield className="h-3 w-3 mr-1" />
                  Owner
                </Badge>
              )}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{adminUser?.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{adminUser?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/settings" className="flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Settings
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleClearSession} className="text-orange-600 focus:text-orange-600">
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear Session
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme Toggle */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="w-full mt-2 justify-start h-auto p-2 hover:bg-accent"
        onClick={toggleTheme}
      >
        <div className="flex items-center space-x-3 w-full">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted">
            {theme === "dark" ? (
              <Sun className="h-3 w-3" />
            ) : (
              <Moon className="h-3 w-3" />
            )}
          </div>
          <span className="text-sm">
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </div>
      </Button>
    </div>
  );
}



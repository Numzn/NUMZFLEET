import { Calendar, Car, Fuel, Moon, Sun, User, BarChart, TrendingUp, MapPin, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SyncStatusIndicator } from "@/components/data-sync/SyncStatusIndicator";
import React from "react";

export function NavigationBar() {
  const { theme, setTheme } = useTheme();
  const { adminUser, logout, isOwner } = useAuth();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-background border-b shadow-sm flex items-center justify-between px-6 h-16">
      <div className="flex items-center space-x-3">
        <Fuel className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg">NumzFleet</span>
        <div className="ml-8 flex items-center space-x-4">
          <a href="/" className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2 font-semibold text-primary">
              <Calendar className="h-5 w-5" />
              <span>Dashboard</span>
            </Button>
          </a>
          <a href="/vehicles" className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <Car className="h-5 w-5" />
              <span>Vehicle Management</span>
            </Button>
          </a>
          <a href="/reports" className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <BarChart className="h-5 w-5" />
              <span>Reports</span>
            </Button>
          </a>
          <a href="/analytics" className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Analytics</span>
            </Button>
          </a>
          <a href="/tracking" className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Live Tracking</span>
            </Button>
          </a>
          <a href="/traccar-admin" className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>GPS Admin</span>
            </Button>
          </a>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {/* Sync Status Indicator */}
        <SyncStatusIndicator />
        
        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{adminUser?.name || 'Admin'}</span>
              {isOwner && (
                <Badge variant="secondary" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Owner
                </Badge>
              )}
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
                <Fuel className="h-4 w-4 mr-2" />
                Settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" aria-label="Toggle Theme" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>
    </nav>
  );
}

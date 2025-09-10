import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const SessionStatus: React.FC = () => {
  const { user, checkSessionHealth, refreshSession, forceLogout } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sessionHealthy, setSessionHealthy] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;

    // Check session health on mount
    const checkHealth = () => {
      const healthy = checkSessionHealth();
      setSessionHealthy(healthy);
      setLastCheck(new Date());
    };

    checkHealth();

    // Check every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, checkSessionHealth]);

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    try {
      const success = await refreshSession();
      if (success) {
        setSessionHealthy(true);
        setLastCheck(new Date());
        toast({
          title: "Session Refreshed",
          description: "Your session has been refreshed successfully.",
        });
      } else {
        setSessionHealthy(false);
        toast({
          title: "Session Refresh Failed",
          description: "Failed to refresh your session. Please log in again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      setSessionHealthy(false);
      toast({
        title: "Session Error",
        description: "An error occurred while refreshing your session.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleForceLogout = async () => {
    try {
      await forceLogout();
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully.",
      });
    } catch (error) {
      console.error('Force logout error:', error);
      toast({
        title: "Logout Error",
        description: "An error occurred while logging out.",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-background/95 backdrop-blur-sm rounded-lg border">
      <div className="flex items-center gap-2">
        <Badge 
          variant={sessionHealthy ? "default" : "destructive"}
          className="flex items-center gap-1"
        >
          {sessionHealthy ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Session Active
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3" />
              Session Issue
            </>
          )}
        </Badge>
        
        {lastCheck && (
          <span className="text-xs text-muted-foreground">
            Last check: {lastCheck.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefreshSession}
          disabled={isRefreshing}
          className="h-7 px-2"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
        
        <Button
          size="sm"
          variant="outline"
          onClick={handleForceLogout}
          className="h-7 px-2"
        >
          <LogOut className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

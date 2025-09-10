import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SessionMonitorProps {
  children: React.ReactNode;
}

export const SessionMonitor: React.FC<SessionMonitorProps> = ({ children }) => {
  const { user, checkSessionHealth, refreshSession, forceLogout } = useAuth();
  const { toast } = useToast();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    if (!user) return;

    setIsMonitoring(true);
    console.log('🔍 SessionMonitor: Starting session monitoring');

    // Monitor session health every 2 minutes
    const healthCheckInterval = setInterval(async () => {
      const isHealthy = checkSessionHealth();
      
      if (!isHealthy) {
        console.log('⚠️ SessionMonitor: Session unhealthy, attempting refresh');
        
        try {
          const refreshed = await refreshSession();
          if (!refreshed) {
            console.log('❌ SessionMonitor: Session refresh failed, logging out');
            toast({
              title: "Session Expired",
              description: "Your session has expired. Please log in again.",
              variant: "destructive",
            });
            await forceLogout();
          } else {
            console.log('✅ SessionMonitor: Session refreshed successfully');
          }
        } catch (error) {
          console.error('❌ SessionMonitor: Error during session refresh:', error);
          await forceLogout();
        }
      } else {
        console.log('✅ SessionMonitor: Session is healthy');
      }
    }, 2 * 60 * 1000); // 2 minutes

    // Monitor user activity
    const updateActivity = () => {
      setLastActivity(Date.now());
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // Check for inactivity (30 minutes)
    const inactivityCheck = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      
      if (timeSinceActivity > 30 * 60 * 1000) { // 30 minutes
        console.log('⏰ SessionMonitor: User inactive for 30 minutes');
        // Don't auto-logout, just log the inactivity
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('👁️ SessionMonitor: Page hidden');
      } else {
        console.log('👁️ SessionMonitor: Page visible, checking session');
        const isHealthy = checkSessionHealth();
        if (!isHealthy) {
          refreshSession();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle beforeunload
    const handleBeforeUnload = () => {
      console.log('🚪 SessionMonitor: Page unloading');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('🛑 SessionMonitor: Stopping session monitoring');
      setIsMonitoring(false);
      clearInterval(healthCheckInterval);
      clearInterval(inactivityCheck);
      
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, checkSessionHealth, refreshSession, forceLogout, toast, lastActivity]);

  // Show session status in development
  if (process.env.NODE_ENV === 'development' && isMonitoring) {
    return (
      <>
        {children}
        <div className="fixed bottom-4 right-4 z-50 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
          🔍 Session Monitoring Active
        </div>
      </>
    );
  }

  return <>{children}</>;
};

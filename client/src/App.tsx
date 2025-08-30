import { Switch, Route, useLocation, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { DataSyncProvider } from "@/components/data-sync/DataSyncProvider";
import { PageLoading } from "@/components/ui/loading";
// TODO: Replace with Supabase session management
// import "@/lib/session-utils";

import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/dashboard";
import VehicleManagement from "@/pages/vehicle-management";
import NotFound from "@/pages/not-found";
import Settings from "@/pages/settings";
import AdvancedReports from "@/pages/advanced-reports";
import Reports from "@/pages/reports";
import Analytics from "@/pages/analytics";
import LiveTracking from "@/pages/live-tracking";
import LoginPage from "@/pages/login";
// TODO: Replace with Supabase admin reset
// import AdminResetPage from "@/pages/admin-reset";
import DebugPage from "@/pages/debug";
import TraccarAdmin from "@/pages/traccar-admin";
import React from "react";

function AppContent() {
  const { user, adminUser, isLoading, forceLogin, debugAuthState } = useAuth();

  // Debug auth state on mount
  React.useEffect(() => {
    console.log('🔍 AppContent mounted - Auth state:');
    debugAuthState();
  }, [debugAuthState]);

  // Show loading skeleton while checking authentication
  if (isLoading) {
    console.log('⏳ Showing loading skeleton...');
    return <PageLoading />;
  }

  // Check authentication conditions
  const shouldShowLogin = forceLogin || !user || !adminUser;
  
  console.log('🔍 Auth check:', {
    forceLogin,
    hasUser: !!user,
    hasAdminUser: !!adminUser,
    shouldShowLogin
  });

  // Show login page if authentication is required
  if (shouldShowLogin) {
    console.log('🔒 Showing login page...');
    return (
      <Switch>
        {/* TODO: Replace with Supabase admin reset */}
        {/* <Route path="/admin-reset" component={AdminResetPage} /> */}
        <Route component={LoginPage} />
      </Switch>
    );
  }

  // Show main app only after successful authentication
  console.log('✅ Showing main app...');
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/vehicles" component={VehicleManagement} />
        <Route path="/tracking" component={LiveTracking} />
        <Route path="/traccar-admin" component={TraccarAdmin} />
        <Route path="/reports" component={AdvancedReports} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <NavigationProvider>
              <DataSyncProvider>
                <Router>
                  <AppContent />
                  <Toaster />
                </Router>
              </DataSyncProvider>
            </NavigationProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

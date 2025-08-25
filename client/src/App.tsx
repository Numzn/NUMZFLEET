import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataSyncProvider } from "@/components/data-sync/DataSyncProvider";
import "@/lib/session-utils"; // Load session management utilities

import { Skeleton } from "@/components/ui/skeleton";
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
import AdminResetPage from "@/pages/admin-reset";
import DebugPage from "@/pages/debug";
import TraccarAdmin from "@/pages/traccar-admin";

function AppContent() {
  const { user, adminUser, isLoading, forceLogin } = useAuth();

  // Show loading skeleton while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-[300px]">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  // ALWAYS show login page if forceLogin is true, regardless of existing sessions
  // This ensures users must go through the login process every time
  if (forceLogin || !user || !adminUser) {
    return (
      <Switch>
        <Route path="/admin-reset" component={AdminResetPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  // Show main app only after successful authentication and forceLogin is false
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
            <DataSyncProvider>
              <AppContent />
              <Toaster />
            </DataSyncProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

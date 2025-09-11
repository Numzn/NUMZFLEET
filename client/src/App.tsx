import { Switch, Route, Router } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { DataSyncProvider } from "@/components/data-sync/DataSyncProvider";
import { PageLoading } from "@/components/ui/loading";

import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/dashboard";
import VehicleManagement from "@/pages/vehicle-management";
import NotFound from "@/pages/not-found";
import Settings from "@/pages/settings";
import AdvancedReports from "@/pages/advanced-reports";
import Reports from "@/pages/reports";
import Analytics from "@/pages/analytics";
import LiveTracking from "@/pages/live-tracking-new";
import { SimpleLoginForm } from "@/components/auth/SimpleLoginForm";
import TraccarAdmin from "@/pages/traccar-admin";
import MapTestPage from "@/pages/map-test";
import TraccarTestPage from "@/pages/traccar-test";
import EnvTestPage from "@/pages/env-test";
import React from "react";

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return (
      <Switch>
        <Route component={SimpleLoginForm} />
      </Switch>
    );
  }

  // Show main app after successful authentication
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/vehicles" component={VehicleManagement} />
        <Route path="/tracking" component={LiveTracking} />
        <Route path="/map-test" component={MapTestPage} />
        <Route path="/traccar-test" component={TraccarTestPage} />
        <Route path="/env-test" component={EnvTestPage} />
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
  );
}
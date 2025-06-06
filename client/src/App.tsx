import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Button } from "@/components/ui/button";
import Dashboard from "@/pages/dashboard";
import VehicleManagement from "@/pages/vehicle-management";
import NotFound from "@/pages/not-found";
import { BarChart3, Car, Fuel } from "lucide-react";

function Navigation() {
  const [location] = useLocation();
  
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Fuel className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-bold">Fleet Manager</h1>
            </div>
            
            <div className="hidden md:flex space-x-1">
              <Link href="/">
                <Button 
                  variant={location === "/" ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>
              </Link>
              
              <Link href="/vehicles">
                <Button 
                  variant={location === "/vehicles" ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Car className="h-4 w-4" />
                  <span>Vehicle Management</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/vehicles" component={VehicleManagement} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="fleet-fuel-ui-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

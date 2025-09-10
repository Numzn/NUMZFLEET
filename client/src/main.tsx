import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/ui/theme-provider";
import { Toaster } from "./components/ui/toaster";
import { ErrorBoundary } from "./components/error-boundary";
import App from "./App";
import "./index.css";
import "leaflet/dist/leaflet.css";

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Initialize Supabase (will be added later)
// import "./lib/supabase";

// Development debugging functions
if (import.meta.env.DEV) {
  // Add legacy Traccar debugging functions
  import("./lib/traccar-auth")
    .then(({ debugTraccarAuth, authenticateTraccarBackground, getTraccarCredentials }) => {
      (window as any).debugTraccarAuth = debugTraccarAuth;
      (window as any).authenticateTraccarBackground = authenticateTraccarBackground;
      (window as any).getTraccarCredentials = getTraccarCredentials;
    })
    .catch(console.error);
  
  // Add Traccar sync service debugging
  import("./lib/traccar-sync")
    .then(({ traccarSync }) => {
      (window as any).traccarSync = traccarSync;
      console.log('🔧 Traccar sync service exported to window.traccarSync');
      console.log('📊 Current sync service status:', traccarSync.getStatus());
    })
    .catch(console.error);
  
  console.log("🔧 Traccar debugging functions available in console:");
  console.log("  - debugTraccarAuth() - Check Traccar authentication status");
  console.log("  - authenticateTraccarBackground() - Manually trigger Traccar auth");
  console.log("  - getTraccarCredentials() - View configured Traccar credentials");
  console.log("  - traccarSync.getStatus() - Check sync service status");
  console.log("  - traccarSync.resetCredentialErrors() - Reset credential errors");
  console.log("  - traccarSync.testConnection() - Test Traccar connection");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
          <App />
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load env file from project root directory
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  
  console.log('🔍 Vite env loading:', {
    mode,
    cwd: process.cwd(),
    hasUrl: !!env.VITE_SUPABASE_URL,
    hasKey: !!env.VITE_SUPABASE_ANON_KEY,
    url: env.VITE_SUPABASE_URL?.substring(0, 20) + '...'
  });
  
  return {
  plugins: [
    react(),
    // Only include Replit plugins in development
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          import("@replit/vite-plugin-cartographer").then((m) =>
            m.default(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs']
        }
      }
    }
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  envDir: path.resolve(import.meta.dirname), // Tell Vite to look for .env in root directory
  define: {
    // Make env variables available to the client
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV),
    'import.meta.env.VITE_APP_NAME': JSON.stringify(env.VITE_APP_NAME),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION),
    'import.meta.env.VITE_TRACCAR_URL': JSON.stringify(env.VITE_TRACCAR_URL),
    'import.meta.env.VITE_TRACCAR_USERNAME': JSON.stringify(env.VITE_TRACCAR_USERNAME),
    'import.meta.env.VITE_TRACCAR_PASSWORD': JSON.stringify(env.VITE_TRACCAR_PASSWORD),
    'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
    'import.meta.env.VITE_APP_URL': JSON.stringify(env.VITE_APP_URL)
  }
  };
});

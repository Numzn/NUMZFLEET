import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/** Always treat this frontend folder as the Vite root (fixes @mui resolve when `vite` runs from repo root). */
const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load env from this package directory (same as `root`), not process.cwd().
  const env = loadEnv(mode, frontendRoot, '');
  
  // Dev server port (`vite --port` still overrides this at runtime).
  // Default dev port avoids clashing with Dockerized static frontend (host :3002).
  const devServerPort = parseInt(env.VITE_DEV_SERVER_PORT || '5174', 10);
  // Mobile / LAN: set VITE_HMR_EXTERNAL to this machine’s IP so phones can reach the HMR WebSocket.
  // Otherwise use `hmr: true` so the WebSocket uses the same port as the page (fixes e.g. page on :3003 but ws on :3002).
  const hmrExternal = String(env.VITE_HMR_EXTERNAL || '').trim();
  const useCustomHmr = Boolean(hmrExternal);

  // Detect environment mode
  const isLocalDev = env.LOCAL_DEV === 'true';
  const isProd = mode === 'production';
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost';
  const remoteApiBaseUrl = env.REMOTE_API_BASE_URL || env.VITE_REMOTE_API_BASE_URL;
  /** When using REMOTE_API_BASE_URL for Traccar, point fuel-only routes to a host that serves fuel-api (e.g. http://localhost:3000). */
  const explicitFuelApiUrl = env.VITE_FUEL_API_URL || env.VITE_FUEL_API_BASE_URL;

  // Determine backend URLs based on environment
  let traccarUrl, fuelApiUrl;
  
  if (isProd) {
    // Production build: API base from VITE_API_BASE_URL (same-origin nginx / static host, etc.)
    traccarUrl = `${apiBaseUrl}/api/traccar`;
    fuelApiUrl = `${apiBaseUrl}/api/fuel`;
    console.log('🌐 [Vite] Running in PRODUCTION mode (env / same-origin API base)');
    console.log(`   API Base: ${apiBaseUrl}`);
    console.log(`   Traccar: ${traccarUrl}`);
    console.log(`   Fuel API: ${fuelApiUrl}`);
  } else if (isLocalDev) {
    // Docker on localhost + Vite HMR (`npm run start:local`). Must win over REMOTE_* in .env.
    traccarUrl = 'http://localhost:8082';
    fuelApiUrl = 'http://localhost:3000';
    console.log('🔧 [Vite] Running in LOCAL development mode');
    console.log(`   Traccar: ${traccarUrl}`);
    console.log(`   Fuel API: ${fuelApiUrl}`);
  } else if (remoteApiBaseUrl) {
    // Local frontend + hosted Traccar: fuel-api usually runs on Docker localhost:3000, not on the remote host.
    const fuelUsesRemote = env.VITE_FUEL_PROXY_USE_REMOTE === 'true';
    traccarUrl = remoteApiBaseUrl;
    fuelApiUrl =
      explicitFuelApiUrl ||
      (fuelUsesRemote ? remoteApiBaseUrl : 'http://localhost:3000');
    console.log('☁️ [Vite] Running in REMOTE backend mode');
    console.log(`   Remote Base: ${remoteApiBaseUrl}`);
    console.log(`   Traccar: ${traccarUrl}`);
    console.log(
      `   Fuel API: ${fuelApiUrl}${
        explicitFuelApiUrl
          ? ' (VITE_FUEL_API_URL)'
          : fuelUsesRemote
            ? ' (VITE_FUEL_PROXY_USE_REMOTE)'
            : ' (default localhost:3000)'
      }`
    );
  } else {
    // Vite runs on the host; root Compose maps traccar:8082 and backend (fuel-api):3000 to localhost.
    // Set VITE_PROXY_INTERNAL_DOCKER=true only if the dev server runs inside the Compose network.
    const internalDocker = env.VITE_PROXY_INTERNAL_DOCKER === 'true';
    traccarUrl = internalDocker ? 'http://traccar:8082' : 'http://localhost:8082';
    fuelApiUrl = internalDocker ? 'http://backend:3000' : 'http://localhost:3000';
    console.log(internalDocker ? '🐳 [Vite] Running in DOCKER (internal) proxy mode' : '🐳 [Vite] Running in DOCKER-style dev (localhost proxy targets)');
    console.log(`   Traccar: ${traccarUrl}`);
    console.log(`   Fuel API: ${fuelApiUrl}`);
  }

  return {
    root: frontendRoot,
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        '@mui/material',
        '@mui/system',
        '@mui/utils',
        '@emotion/react',
        '@emotion/styled',
      ],
    },
    server: {
      port: devServerPort,
      // Fail fast when the port is taken — avoids a second Vite on :5175 that shares the same proxy target and amplifies Socket.IO reconnect storms.
      strictPort: !isProd,
      host: '0.0.0.0',
      ...(useCustomHmr
        ? {
            hmr: {
              host: hmrExternal,
              port: parseInt(env.VITE_HMR_PORT || String(devServerPort), 10),
              clientPort: parseInt(
                env.VITE_HMR_CLIENT_PORT || env.VITE_HMR_PORT || String(devServerPort),
                10
              ),
            },
          }
        : { hmr: true }),
      proxy: {
      // IMPORTANT: Order matters! More specific routes should come first
      // Socket.IO proxy MUST come before /api routes to avoid conflicts
      '/api/socket': {
        target: traccarUrl,
        ws: true,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { '*': 'localhost' },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
        },
      },
      // WebSocket proxy for fuel API Socket.IO
      // IMPORTANT: This must match Socket.IO requests BEFORE other routes
      // Socket.IO requests: /socket.io/?EIO=4&transport=polling&t=...
      '/socket.io': {
        target: fuelApiUrl,
        ws: true,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          '*': 'localhost'
        },
        // Don't rewrite the path - Socket.IO needs the full path with query params
        rewrite: (path) => path,
        // Ensure this proxy handles both HTTP and WebSocket
        configure: (proxy, options) => {
          const isDev = process.env.NODE_ENV === 'development';
          
          // Handle HTTP requests (Socket.IO handshake)
          proxy.on('proxyReq', (proxyReq, req, res) => {
            if (isDev) {
              console.log('🔌 [Vite Proxy] Socket.IO HTTP request:', req.url);
            }
            
            // Forward cookies for authentication
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            
            // Forward other important headers
            if (req.headers['x-forwarded-for']) {
              proxyReq.setHeader('X-Forwarded-For', req.headers['x-forwarded-for']);
            }
          });
          
          // Handle WebSocket upgrade requests
          proxy.on('upgrade', (req, socket, head) => {
            if (isDev) {
              console.log('🔌 [Vite Proxy] Socket.IO WebSocket upgrade:', req.url);
            }
          });
          
          proxy.on('error', (err, req, socket) => {
            console.error('❌ [Vite Proxy] Socket.IO proxy error:', err.message);
            if (socket && !socket.destroyed) {
              socket.end();
            }
          });
          
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (isDev && proxyRes.statusCode >= 400) {
              console.error(`⚠️ [Vite Proxy] Socket.IO response error: ${proxyRes.statusCode}`, req.url);
            }
          });
        },
      },
      '/api/fuel-requests': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          '*': 'localhost'
        },
        configure: (proxy, options) => {
          const isDev = process.env.NODE_ENV === 'development';
          
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // CRITICAL: Forward all cookies to fuel-api
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
              if (isDev) {
                console.log('🍪 Forwarding cookies to fuel-api');
              }
            }
            
            // Also forward x-user-id header if present (fallback authentication)
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            }
          });
          
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Forward Set-Cookie headers back to client
            if (proxyRes.headers['set-cookie']) {
              proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                return cookie.replace(/Domain=[^;]+/gi, 'Domain=localhost');
              });
            }
          });
          
          proxy.on('error', (err, req, res) => {
            console.error('❌ [Vite Proxy] Fuel API proxy error:', err.message);
          });
        },
      },
      '/api/auth': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { '*': 'localhost' },
      },
      '/api/fleet': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { '*': 'localhost' },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            }
          });
        },
      },
      '/api/notifications': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          '*': 'localhost'
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            }
          });
        },
      },
      '/api/vehicle-specs': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          '*': 'localhost'
        },
      },
      '/api/vehicles': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          '*': 'localhost'
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            }
          });
        },
      },
      // Fuel API: public login insight (must be before catch-all /api → Traccar)
      '/api/public': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
      },
      // fuel-api health (must be before catch-all /api → Traccar). Setup save uses /api/vehicles on fuel-api.
      '/api/health': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
      },
      // fuel-api report routes only (Traccar uses /api/reports/stops, /route, POST /api/reports, etc.)
      '/api/reports/trips': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { '*': 'localhost' },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            }
          });
        },
      },
      '/api/reports/summary': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { '*': 'localhost' },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            }
          });
        },
      },
      '/api/reports/fuel-summary': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { '*': 'localhost' },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            }
          });
        },
      },
      '/api/reports/erb/latest': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { '*': 'localhost' },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            }
          });
        },
      },
      '/api/operation-sessions': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          '*': 'localhost'
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            }
          });
        },
      },
      // Traccar when VITE_TRACCAR_PREFIX=/traccar (strip prefix; same as nginx location /traccar/)
      '/traccar': {
        target: traccarUrl,
        ws: true,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { '*': 'localhost' },
        rewrite: (path) => path.replace(/^\/traccar/, '') || '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
        },
      },
      '/api': {
        target: traccarUrl,
        changeOrigin: true,
        secure: false,
      },
      // Session endpoint (Traccar uses /session not /api/session)
      '/session': {
        target: traccarUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  plugins: [
    svgr(),
    react(),
    VitePWA({
      includeAssets: ['NUMZLOGO.png', 'apple-touch-icon.png', 'favicon-32x32.png'],
      strategies: 'generateSW', // Generate service worker with workbox
      // Enable service worker in development mode
      // DISABLED: Service worker causes ERR_EMPTY_RESPONSE in dev mode
      // Re-enable for production testing if needed
      devOptions: {
        enabled: false, // Disabled to prevent ERR_EMPTY_RESPONSE in development
        type: 'module',
        navigateFallback: 'index.html',
      },
      // Register service worker automatically
      registerType: 'autoUpdate',
      workbox: {
        // Ship new SW immediately; take control so precache updates apply without a second reload.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api/, /^\/traccar/],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Do NOT precache index.html — it pins an old SPA shell + old hashed chunk names after deploy.
        // Navigation still works: Workbox serves navigateFallback from the network when uncached.
        globPatterns: ['**/*.{js,css,woff,woff2,mp3,png,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
        // Inject our custom push notification handlers
        importScripts: ['/sw-push.js'], // Custom push notification handlers
      },
      manifest: {
        short_name: 'NUMZTRAK',
        name: 'NUMZTRAK - Professional Fleet Management',
        description: 'Real-time fuel request management for fleet operations',
        theme_color: '#0A2540',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon-192-v2.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512-v2.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['business', 'productivity', 'utilities'],
      },
      // Disable manifest injection in HTML if commented out
      injectManifest: false,
    }),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js', dest: '' },
      ],
    }),
  ],
  };
});
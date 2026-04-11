import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Allow configurable HMR host for mobile device access
  // Set VITE_HMR_EXTERNAL env var to your host IP (e.g., 10.152.184.242) for mobile access
  // If not set, defaults to 'localhost' for local development
  // Use process.env in config file (import.meta.env is for runtime, not config time)
  const hmrHost = env.VITE_HMR_EXTERNAL || env.VITE_HMR_HOST || 'localhost';
  const hmrPort = env.VITE_HMR_PORT || 3002;

  // Detect environment mode
  const isLocalDev = env.LOCAL_DEV === 'true';
  const isProd = mode === 'production';
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost';
  const remoteApiBaseUrl = env.REMOTE_API_BASE_URL || env.VITE_REMOTE_API_BASE_URL;
  
  // Determine backend URLs based on environment
  let traccarUrl, fuelApiUrl;
  
  if (isProd) {
    // Production (Netlify) - use environment variables
    traccarUrl = `${apiBaseUrl}/api/traccar`;
    fuelApiUrl = `${apiBaseUrl}/api/fuel`;
    console.log('🌐 [Vite] Running in PRODUCTION mode (Netlify)');
    console.log(`   API Base: ${apiBaseUrl}`);
    console.log(`   Traccar: ${traccarUrl}`);
    console.log(`   Fuel API: ${fuelApiUrl}`);
  } else if (remoteApiBaseUrl) {
    // Local frontend + hosted backend (recommended for integration checks)
    traccarUrl = remoteApiBaseUrl;
    fuelApiUrl = remoteApiBaseUrl;
    console.log('☁️ [Vite] Running in REMOTE backend mode');
    console.log(`   Remote Base: ${remoteApiBaseUrl}`);
    console.log(`   Traccar: ${traccarUrl}`);
    console.log(`   Fuel API: ${fuelApiUrl}`);
  } else if (isLocalDev) {
    // Local development
    traccarUrl = 'http://localhost:8082';
    fuelApiUrl = 'http://localhost:3001';
    console.log('🔧 [Vite] Running in LOCAL development mode');
    console.log(`   Traccar: ${traccarUrl}`);
    console.log(`   Fuel API: ${fuelApiUrl}`);
  } else {
    // Docker development
    traccarUrl = 'http://traccar-server:8082';
    fuelApiUrl = 'http://fuel-api:3001';
    console.log('🐳 [Vite] Running in DOCKER mode');
    console.log(`   Traccar: ${traccarUrl}`);
    console.log(`   Fuel API: ${fuelApiUrl}`);
  }

  return {
    server: {
      port: 3002,
      host: '0.0.0.0',
      hmr: {
        port: parseInt(hmrPort, 10),
        host: hmrHost,
        clientPort: parseInt(hmrPort, 10),
      },
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
      '/api/vehicle-specs': {
        target: fuelApiUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          '*': 'localhost'
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
        navigateFallbackDenylist: [/^\/api/],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,woff,woff2,mp3,png,svg,ico}'],
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
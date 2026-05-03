import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import sequelize, { testConnection } from './config/database.js';
import { testTraccarConnection } from './services/userService.js';
import { initializeAuth, authenticate } from './middleware/auth.js';
import { requireAuth } from './middleware/authGates.js';
import { suggestVehicles } from './controllers/operationSessionController.js';
import { syncDatabase } from './models/index.js';
import fuelRequestsRouter from './fuelRequests/routes/fuelRequests.js';
import vehicleSpecsRouter from './routes/vehicleSpecs.js';
import vehiclesRouter from './routes/vehicles.js';
import operationSessionsRouter from './routes/operationSessions.js';
import reportsRouter from './reports/routes/reports.js';
import { initializeSocket } from './socket/socketHandler.js';
import { registerEventListeners } from './events/registerEventListeners.js';
import { startErbLoginInsightScheduler } from './jobs/erbLoginInsightScheduler.js';
import { reconcileDeviceAssignmentLabels } from './services/vehicleFleetService.js';
import {
  ensurePublicLoginInsightFromErb,
  getPublicLoginInsight,
  isLoginInsightPopulated,
} from './services/traccarLoginInsightSync.js';
import { getFleetSummary } from './services/fleetSummaryService.js';

// Load environment variables
dotenv.config();

// Get database URLs from environment (matching docker-compose)
const DATABASE_URL = process.env.DATABASE_URL || 
  `postgresql://numztrak:${process.env.POSTGRES_PASSWORD || 'NumzFuel2025'}@db:5432/numztrak_fuel`;

const TRACCAR_MYSQL_CONFIG = {
  host: process.env.TRACCAR_MYSQL_HOST || 'traccar-mysql',
  port: process.env.TRACCAR_MYSQL_PORT || 3306,
  database: process.env.TRACCAR_MYSQL_DATABASE || process.env.MYSQL_DATABASE || 'traccar',
  user: process.env.TRACCAR_MYSQL_USER || process.env.MYSQL_USER || 'traccar',
  password: process.env.TRACCAR_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || 'traccar123'
};

// Ensure these values are set in process.env for config files to use
process.env.DATABASE_URL = DATABASE_URL;
process.env.TRACCAR_MYSQL_HOST = TRACCAR_MYSQL_CONFIG.host;
process.env.TRACCAR_MYSQL_PORT = TRACCAR_MYSQL_CONFIG.port.toString();
process.env.TRACCAR_MYSQL_DATABASE = TRACCAR_MYSQL_CONFIG.database;
process.env.TRACCAR_MYSQL_USER = TRACCAR_MYSQL_CONFIG.user;
process.env.TRACCAR_MYSQL_PASSWORD = TRACCAR_MYSQL_CONFIG.password;

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV === 'development';
const app = express();
const httpServer = createServer(app);

/** Browsers send these when Vite (or similar) runs on the host and fuel-api is in Docker. */
const LOCAL_VITE_ORIGINS = [
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// CORS configuration - support multiple origins for mobile apps
const getCorsOrigin = () => {
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5174';
  let origins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  // Union local SPA dev origins so Socket.IO + REST from Vite are not rejected when CORS_ORIGIN is prod-only.
  if (process.env.CORS_STRICT !== 'true') {
    for (const o of LOCAL_VITE_ORIGINS) {
      if (!origins.includes(o)) origins.push(o);
    }
  }

  // If '*' is in the list, allow all origins (development only)
  if (origins.includes('*')) {
    return (origin, callback) => {
      callback(null, true);
    };
  }

  return (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  };
};

// Initialize Socket.IO with flexible CORS
const io = new Server(httpServer, {
  cors: {
    origin: getCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-user-id'],
  },
  // Add additional options for stability
  allowEIO3: true, // Allow Engine.IO v3 clients for compatibility
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  maxHttpBufferSize: 1e8, // 100MB
  connectTimeout: 45000, // 45 seconds
  // Add path explicitly (should match client)
  path: '/socket.io',
  // Add transports
  transports: ['polling', 'websocket'],
});

// Add global error handlers BEFORE initializing socket handler
io.engine.on('connection_error', (err) => {
  console.error('❌ [Socket.IO Engine] Connection error:', {
    message: err.message,
    code: err.code,
    context: err.context,
    req: err.req?.url,
    description: err.description,
  });
  if (err.context) {
    console.error('Error context:', err.context);
  }
});

// Handle upgrade errors
io.engine.on('upgrade_error', (err) => {
  console.error('❌ [Socket.IO Engine] Upgrade error:', err.message);
  console.error('Stack:', err.stack);
});

// Trust Nginx reverse proxy - required for rate-limiter and correct IP detection
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
})); // Security headers with relaxed CSP for map tiles
// Include x-user-id so permissive/hybrid dev auth works when browsers preflight (JSON Content-Type, etc.).
const ALLOWED_API_HEADERS = ['Content-Type', 'Authorization', 'Cookie', 'x-user-id'];

app.use(cors({
  origin: getCorsOrigin(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ALLOWED_API_HEADERS,
}));

const RATE_WINDOW_MS = 15 * 60 * 1000;
const rateLimitMessage = 'Too many requests from this IP, please try again later.';

// Public endpoints are intentionally read-heavy (login widgets, summaries).
const relaxedLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: 1000,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

// General API traffic limiter.
const standardLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: 300,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  // Public endpoints have their own relaxed limiter.
  skip: (req) => req.path.startsWith('/public/'),
});

// Sensitive write actions are throttled more aggressively.
const strictLimiter = rateLimit({
  windowMs: RATE_WINDOW_MS,
  max: 100,
  message: rateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

const STRICT_PATH_PREFIXES = [
  '/fuel-requests',
  '/operation-sessions',
  '/vehicles',
  '/vehicle-specs',
];

const shouldUseStrictLimiter = (req) => {
  const method = req.method.toUpperCase();
  const isMutation = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  if (!isMutation) {
    return false;
  }
  return STRICT_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix));
};

// Rate limiting
app.use('/api/public', relaxedLimiter);
app.use('/api', (req, res, next) => {
  if (shouldUseStrictLimiter(req)) {
    return strictLimiter(req, res, next);
  }
  return next();
});
app.use('/api', standardLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Attach Socket.IO to requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'numztrak-fuel-api' });
});

/** Unauthenticated: ERB fuel lines for login (same adapter as /api/reports/erb/latest; fills cache on demand). */
app.get('/api/public/login-insight', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const data = await ensurePublicLoginInsightFromErb();
    res.json({
      ...data,
      erbAvailable: isLoginInsightPopulated(data),
    });
  } catch (err) {
    console.warn('[login-insight] fallback to cache:', err?.message || err);
    const fallback = getPublicLoginInsight();
    res.json({
      ...fallback,
      erbAvailable: isLoginInsightPopulated(fallback),
    });
  }
});

// Diagnostic endpoint to check authentication (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/auth-check', async (req, res) => {
    try {
      const sessionToken = req.cookies?.JSESSIONID;
      const userIdFromHeader = req.headers['x-user-id'];
      
      res.json({
        hasSessionToken: !!sessionToken,
        hasUserIdHeader: !!userIdFromHeader,
        cookies: Object.keys(req.cookies || {}),
        sessionTokenPreview: sessionToken ? sessionToken.substring(0, 20) + '...' : null,
        userIdHeader: userIdFromHeader
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Test WebSocket endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/test-websocket', (req, res) => {
    try {
      if (!req.io) {
        return res.json({ 
          error: 'req.io is not available',
          reqIoExists: false
        });
      }
      
      // Get connected sockets count
      const sockets = req.io.sockets?.sockets;
      const socketCount = sockets ? sockets.size : 0;
      
      // Check rooms
      const adapter = req.io.sockets?.adapter;
      let managersRoomSize = 0;
      let driverRooms = {};
      
      if (adapter) {
        const managersRoom = adapter.rooms?.get('managers');
        managersRoomSize = managersRoom ? managersRoom.size : 0;
        
        // Get all driver rooms
        adapter.rooms?.forEach((sockets, roomName) => {
          if (roomName.startsWith('driver-')) {
            driverRooms[roomName] = sockets.size;
          }
        });
      }
      
      // Test emit to all sockets
      req.io.emit('test-event', { 
        message: 'Test from backend', 
        timestamp: new Date().toISOString(),
        test: true
      });
      
      res.json({ 
        success: true, 
        socketCount,
        managersRoomSize,
        driverRooms,
        reqIoExists: true,
        message: 'Test event emitted to all sockets'
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [TEST] Error:', error);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Socket.IO diagnostic endpoint
  app.get('/api/socket-diagnostics', (req, res) => {
    try {
      const sockets = io.sockets?.sockets;
      const socketCount = sockets ? sockets.size : 0;
      
      const adapter = io.sockets?.adapter;
      const rooms = {};
      
      if (adapter && adapter.rooms) {
        adapter.rooms.forEach((socketSet, roomName) => {
          rooms[roomName] = {
            size: socketSet.size,
            sockets: Array.from(socketSet).slice(0, 5) // First 5 socket IDs
          };
        });
      }
      
      res.json({
        success: true,
        socketCount,
        rooms,
        server: {
          connected: io.engine?.clientsCount || 0,
          cors: io.opts?.cors,
          path: io.opts?.path || '/socket.io',
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        error: error.message,
        stack: error.stack 
      });
    }
  });
}

// API Routes
app.use('/api/fuel-requests', fuelRequestsRouter);
app.use('/api/vehicle-specs', vehicleSpecsRouter);
app.use('/api/vehicles', vehiclesRouter);
// Nested path registered on app first so it is never missed if an older router snapshot omits it.
app.get('/api/operation-sessions/suggestions/vehicles', authenticate, requireAuth, suggestVehicles);
app.use('/api/operation-sessions', operationSessionsRouter);
app.use('/api/reports', reportsRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'NumzTrak Fuel Management API',
    version: '1.0.0',
    status: 'running'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize WebSocket with error handling
try {

  /** Unauthenticated: aggregated fleet stats for login page widget (2-min server-side cache). */
  app.get('/api/public/fleet-summary', async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=120');
    try {
      res.json(await getFleetSummary());
    } catch {
      res.json({ totalVehicles: 0, onlineVehicles: 0, pendingFuelRequests: 0, updatedAt: null });
    }
  });
  initializeSocket(io);
  registerEventListeners({ io });
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ [Socket.IO] Socket handler initialized successfully');
  }
} catch (error) {
  console.error('❌ [Socket.IO] Failed to initialize socket handler:', error);
  console.error('Stack:', error.stack);
  // Don't exit - allow server to continue without WebSocket
}

// Start server with retry logic for database connections
/** Stops ERB → login insight interval (if started). */
let stopErbLoginInsightScheduler = () => {};

const startServer = async () => {
  const MAX_RETRIES = 8;
  const RETRY_DELAY = 10000; // 10 seconds
  
  if (isDev) {
    console.log('\n🚀 NumzTrak Fuel API Starting...\n');
  }
  
  // Retry database connections
  let pgConnected = false;
  let traccarConnected = false;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (isDev) {
      console.log(`📊 Testing database connections... (attempt ${attempt}/${MAX_RETRIES})`);
    }
    
    try {
      if (!pgConnected) {
        pgConnected = await testConnection();
        if (!pgConnected && isDev) {
          console.error(`⚠️ PostgreSQL connection failed (attempt ${attempt}/${MAX_RETRIES})`);
          console.error(`   DATABASE_URL: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : 'NOT SET'}`);
        }
      }
      
      if (!traccarConnected) {
        traccarConnected = await testTraccarConnection();
        if (!traccarConnected && isDev) {
          console.error(`⚠️ Traccar MySQL connection failed (attempt ${attempt}/${MAX_RETRIES})`);
          console.error(`   Host: ${process.env.TRACCAR_MYSQL_HOST || 'traccar-mysql'}`);
          console.error(`   User: ${process.env.TRACCAR_MYSQL_USER || 'traccar'}`);
          console.error(`   Database: ${process.env.TRACCAR_MYSQL_DATABASE || 'traccar'}`);
        }
      }
      
      if (pgConnected && traccarConnected) {
        break;
      }
      
      if (attempt < MAX_RETRIES) {
        if (isDev) {
          console.log(`⏳ Retrying in ${RETRY_DELAY / 1000} seconds...`);
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    } catch (error) {
      console.error(`❌ Error during database connection attempt ${attempt}:`, error.message);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  if (!pgConnected || !traccarConnected) {
    console.error('\n❌ Database connection failed after all retries.');
    console.error('   Please check:');
    console.error('   1. Database containers are running');
    console.error('   2. Database credentials match in docker-compose.yml');
    console.error('   3. Database volumes are not corrupted');
    console.error('\n   For PostgreSQL:', {
      url: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@') : 'NOT SET',
      expectedUser: 'numztrak',
      expectedDatabase: 'numztrak_fuel'
    });
    console.error('\n   For MySQL:', {
      host: process.env.TRACCAR_MYSQL_HOST || 'traccar-mysql',
      user: process.env.TRACCAR_MYSQL_USER || 'traccar',
      database: process.env.TRACCAR_MYSQL_DATABASE || 'traccar',
      passwordSet: !!process.env.TRACCAR_MYSQL_PASSWORD
    });
    
    // Don't exit immediately - wait and allow manual intervention
    console.error('\n⚠️ Server will continue in degraded mode. Fix database connections and restart.');
    console.error('   The server will retry connections periodically.\n');
    
    // Start HTTP server anyway (degraded mode)
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n⚠️ Server started in DEGRADED MODE (some features may not work)`);
      console.log(`📡 HTTP Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      if (!pgConnected) console.log(`❌ PostgreSQL: NOT CONNECTED`);
      if (!traccarConnected) console.log(`❌ Traccar MySQL: NOT CONNECTED`);
      console.log('');
      stopErbLoginInsightScheduler = startErbLoginInsightScheduler();
    });
    
    return; // Exit early, don't try to sync database
  }

  // Sync database schema
  try {
    if (isDev) {
      console.log('\n📦 Synchronizing database schema...');
    }
    await syncDatabase();
  } catch (error) {
    console.error('❌ Database sync failed:', error.message);
    console.error('   Server will continue but database operations may fail.');
  }

  // Initialize authentication system
  try {
    await initializeAuth();
  } catch (error) {
    console.error('❌ Authentication initialization failed:', error.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Start HTTP server
  httpServer.listen(PORT, '0.0.0.0', () => {
    if (isDev) {
      console.log('\n✅ NumzTrak Fuel API is running!');
      console.log(`📡 HTTP Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5174'}`);
      console.log(`🗄️ PostgreSQL: Connected`);
      console.log(`🗄️ Traccar MySQL: Connected (read-only)`);
      console.log('\n🎯 Ready to accept fuel requests!\n');
    }
    stopErbLoginInsightScheduler = startErbLoginInsightScheduler();
    reconcileDeviceAssignmentLabels()
      .then((stats) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[vehicle-label-reconcile]', stats);
        }
      })
      .catch((error) => {
        console.warn('[vehicle-label-reconcile] skipped:', error?.message || error);
      });
  });
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  if (isDev) {
    console.log('\n📴 SIGTERM received, shutting down gracefully...');
  }
  stopErbLoginInsightScheduler();
  httpServer.close(() => {
    if (isDev) {
      console.log('✅ Server closed');
    }
    sequelize.close();
    process.exit(0);
  });
});













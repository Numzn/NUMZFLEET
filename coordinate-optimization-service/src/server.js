import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import NodeCache from 'node-cache';
import axios from 'axios';
import { optimizeCoordinates } from './algorithms/douglas-peucker.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', 'config.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Cache configuration - 5 minutes TTL
const cache = new NodeCache({ stdTTL: 300 });

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5174',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Traccar configuration
const TRACCAR_BASE_URL = process.env.TRACCAR_URL || 'https://fleet.numz.site';
const TRACCAR_AUTH = process.env.TRACCAR_AUTH || 'bnVtZXJpbnl5aXJlbmRhMTRAZ21haWwuY29tOm51bXowMDk5'; // Base64 encoded

console.log('🚀 Coordinate Optimization Service Starting...');
console.log('🌐 Traccar URL:', TRACCAR_BASE_URL);
console.log('🔧 Frontend URL:', process.env.FRONTEND_URL || 'http://localhost:5174');

// Helper function to make authenticated requests to Traccar
async function makeTraccarRequest(endpoint, params = {}) {
  const url = `${TRACCAR_BASE_URL}${endpoint}`;
  const queryString = new URLSearchParams(params).toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        'Authorization': `Basic ${TRACCAR_AUTH}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 15000
    });

    return response.data;
  } catch (error) {
    console.error(`❌ Traccar API error for ${endpoint}:`, error.message);
    throw new Error(`Traccar API error: ${error.response?.status || 'Unknown error'}`);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'coordinate-optimization-service',
    version: '1.0.0'
  });
});

// Get optimized devices
app.get('/api/devices', async (req, res) => {
  try {
    const cacheKey = 'devices';
    let devices = cache.get(cacheKey);

    if (!devices) {
      devices = await makeTraccarRequest('/api/devices');
      cache.set(cacheKey, devices);
      console.log(`📱 Fetched ${devices.length} devices from Traccar`);
    }

    res.json(devices);
  } catch (error) {
    console.error('❌ Error fetching devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get optimized positions for a device
app.get('/api/positions', async (req, res) => {
  try {
    const { deviceId, from, to, limit = 1000, optimize = 'true' } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const cacheKey = `positions_${deviceId}_${from}_${to}_${limit}_${optimize}`;
    let result = cache.get(cacheKey);

    if (!result) {
      console.log(`📍 Fetching positions for device ${deviceId} from Traccar...`);
      
      // Try multiple endpoints for historical data
      let rawPositions = [];
      
      // First, try the reports/route endpoint
      try {
        if (from && to) {
          rawPositions = await makeTraccarRequest('/api/reports/route', {
            deviceId,
            from,
            to,
            limit
          });
          console.log(`✅ Route endpoint returned ${rawPositions.length} positions`);
        }
      } catch (routeError) {
        console.log(`⚠️ Route endpoint failed:`, routeError.message);
      }

      // If route endpoint failed, try positions endpoint
      if (rawPositions.length === 0) {
        rawPositions = await makeTraccarRequest('/api/positions', { deviceId });
        
        // Filter by date range if provided
        if (from && to) {
          const fromDate = new Date(from);
          const toDate = new Date(to);
          rawPositions = rawPositions.filter(pos => {
            const posTime = new Date(pos.deviceTime || pos.serverTime);
            return posTime >= fromDate && posTime <= toDate;
          });
        }
        
        console.log(`✅ Positions endpoint returned ${rawPositions.length} positions`);
      }

      if (rawPositions.length === 0) {
        return res.json({
          positions: [],
          optimization: {
            originalCount: 0,
            optimizedCount: 0,
            reductionPercentage: 0,
            statistics: {}
          }
        });
      }

      // Apply optimization if requested
      if (optimize === 'true') {
        const optimizationOptions = {
          tolerance: parseFloat(req.query.tolerance) || 10, // meters
          minSpeed: parseFloat(req.query.minSpeed) || 5, // km/h
          minTimeInterval: parseInt(req.query.minTimeInterval) || 30000, // milliseconds
          maxSpeed: parseFloat(req.query.maxSpeed) || 200, // km/h
          minAccuracy: parseFloat(req.query.minAccuracy) || 100, // meters
          preserveStops: req.query.preserveStops !== 'false',
          preserveSpeedChanges: req.query.preserveSpeedChanges !== 'false'
        };

        const optimizationResult = optimizeCoordinates(rawPositions, optimizationOptions);
        
        result = {
          positions: optimizationResult.optimizedPositions,
          optimization: {
            originalCount: optimizationResult.originalCount,
            optimizedCount: optimizationResult.optimizedCount,
            reductionPercentage: optimizationResult.reductionPercentage,
            statistics: optimizationResult.statistics,
            options: optimizationOptions
          }
        };
      } else {
        result = {
          positions: rawPositions,
          optimization: {
            originalCount: rawPositions.length,
            optimizedCount: rawPositions.length,
            reductionPercentage: 0,
            statistics: {}
          }
        };
      }

      // Cache the result
      cache.set(cacheKey, result);
    }

    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching optimized positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get historical positions with optimization
app.get('/api/history', async (req, res) => {
  try {
    const { 
      deviceId, 
      from, 
      to, 
      limit = 1000,
      tolerance = 10,
      minSpeed = 5,
      minTimeInterval = 30000,
      maxSpeed = 200,
      minAccuracy = 100,
      preserveStops = 'true',
      preserveSpeedChanges = 'true'
    } = req.query;

    if (!deviceId || !from || !to) {
      return res.status(400).json({ 
        error: 'deviceId, from, and to parameters are required' 
      });
    }

    const cacheKey = `history_${deviceId}_${from}_${to}_${limit}_${tolerance}_${minSpeed}`;
    let result = cache.get(cacheKey);

    if (!result) {
      console.log(`🕐 Fetching historical data for device ${deviceId} from ${from} to ${to}`);
      
      // Fetch from Traccar
      const rawPositions = await makeTraccarRequest('/api/reports/route', {
        deviceId,
        from,
        to,
        limit
      });

      if (rawPositions.length === 0) {
        return res.json({
          positions: [],
          optimization: {
            originalCount: 0,
            optimizedCount: 0,
            reductionPercentage: 0,
            statistics: {}
          }
        });
      }

      // Apply optimization
      const optimizationOptions = {
        tolerance: parseFloat(tolerance),
        minSpeed: parseFloat(minSpeed),
        minTimeInterval: parseInt(minTimeInterval),
        maxSpeed: parseFloat(maxSpeed),
        minAccuracy: parseFloat(minAccuracy),
        preserveStops: preserveStops === 'true',
        preserveSpeedChanges: preserveSpeedChanges === 'true'
      };

      const optimizationResult = optimizeCoordinates(rawPositions, optimizationOptions);
      
      result = {
        positions: optimizationResult.optimizedPositions,
        optimization: {
          originalCount: optimizationResult.originalCount,
          optimizedCount: optimizationResult.optimizedCount,
          reductionPercentage: optimizationResult.reductionPercentage,
          statistics: optimizationResult.statistics,
          options: optimizationOptions
        }
      };

      // Cache the result
      cache.set(cacheKey, result);
    }

    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching historical positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get optimization statistics for a device
app.get('/api/optimization-stats/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { from, to, days = 7 } = req.query;

    let startDate, endDate;
    
    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
    }

    const cacheKey = `stats_${deviceId}_${startDate.toISOString()}_${endDate.toISOString()}`;
    let stats = cache.get(cacheKey);

    if (!stats) {
      // Fetch raw data
      const rawPositions = await makeTraccarRequest('/api/reports/route', {
        deviceId,
        from: startDate.toISOString(),
        to: endDate.toISOString(),
        limit: 10000
      });

      if (rawPositions.length === 0) {
        return res.json({
          deviceId: parseInt(deviceId),
          period: {
            from: startDate.toISOString(),
            to: endDate.toISOString()
          },
          totalPositions: 0,
          optimizationPotential: {
            withTolerance10: 0,
            withTolerance25: 0,
            withTolerance50: 0
          }
        });
      }

      // Test different optimization levels
      const tolerance10 = optimizeCoordinates(rawPositions, { tolerance: 10 });
      const tolerance25 = optimizeCoordinates(rawPositions, { tolerance: 25 });
      const tolerance50 = optimizeCoordinates(rawPositions, { tolerance: 50 });

      stats = {
        deviceId: parseInt(deviceId),
        period: {
          from: startDate.toISOString(),
          to: endDate.toISOString()
        },
        totalPositions: rawPositions.length,
        optimizationPotential: {
          withTolerance10: tolerance10.reductionPercentage,
          withTolerance25: tolerance25.reductionPercentage,
          withTolerance50: tolerance50.reductionPercentage
        },
        recommendations: {
          recommendedTolerance: tolerance25.reductionPercentage > 30 ? 25 : 10,
          estimatedBandwidthSavings: Math.round(tolerance25.reductionPercentage),
          estimatedStorageSavings: Math.round(tolerance25.reductionPercentage)
        }
      };

      cache.set(cacheKey, stats);
    }

    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching optimization stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear cache endpoint (for development)
app.post('/api/cache/clear', (req, res) => {
  cache.flushAll();
  console.log('🗑️ Cache cleared');
  res.json({ message: 'Cache cleared successfully' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Coordinate Optimization Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API docs: http://localhost:${PORT}/api/devices`);
  console.log(`🌐 Traccar proxy: http://localhost:${PORT}/api/positions`);
});

export default app;

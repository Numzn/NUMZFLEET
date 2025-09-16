# Coordinate Optimization Integration Guide

This guide shows you how to integrate the coordinate optimization service with your existing Traccar frontend application.

## 🚀 Quick Start

### 1. Start the Optimization Service

```bash
cd coordinate-optimization-service
npm run setup
npm run dev
```

The service will run on `http://localhost:3001`

### 2. Update Frontend Environment

Add to your `.env` file:

```env
VITE_OPTIMIZATION_SERVICE_URL=http://localhost:3001
```

### 3. Replace API Calls

Replace your existing Traccar API calls with optimized versions:

```typescript
// Before (direct Traccar API)
import { traccarApi } from '@/lib/traccar';

// After (optimized API)
import { optimizedTraccarApi } from '@/lib/optimized-traccar';
```

## 📊 Performance Benefits

- **50-80% data reduction** for typical GPS tracks
- **Faster map rendering** with fewer points
- **Reduced bandwidth usage** for mobile applications
- **Better battery life** on mobile devices

## 🔧 Integration Examples

### Basic Device Data

```typescript
// Replace this:
const { data: devices } = useQuery({
  queryKey: ['devices'],
  queryFn: () => traccarApi.getDevices()
});

// With this:
const { data: devices } = useQuery({
  queryKey: ['optimized-devices'],
  queryFn: () => optimizedTraccarApi.getDevices()
});
```

### Optimized Positions

```typescript
// Replace this:
const { data: positions } = useQuery({
  queryKey: ['positions', deviceId],
  queryFn: () => traccarApi.getPositions(deviceId)
});

// With this:
const { data: result } = useQuery({
  queryKey: ['optimized-positions', deviceId],
  queryFn: () => optimizedTraccarApi.getOptimizedPositions(deviceId, {
    tolerance: 10,
    minSpeed: 5,
    preserveStops: true
  })
});

// Access optimized positions and statistics
const positions = result?.positions || [];
const optimization = result?.optimization;
```

### Historical Data with Optimization

```typescript
// Replace this:
const { data: historicalData } = useQuery({
  queryKey: ['historical', deviceId, from, to],
  queryFn: () => historyApi.getHistoricalPositions(deviceId, from, to)
});

// With this:
const { data: result } = useQuery({
  queryKey: ['optimized-historical', deviceId, from, to],
  queryFn: () => optimizedTraccarApi.getOptimizedHistoricalPositions(
    deviceId, 
    from, 
    to, 
    {
      tolerance: 15,
      minSpeed: 5,
      preserveStops: true,
      preserveSpeedChanges: true
    }
  )
});
```

## 🎛️ Optimization Controls

Add the optimization panel to your tracking interface:

```tsx
import { OptimizationPanel } from '@/components/tracking/optimization/OptimizationPanel';

// In your tracking component:
<OptimizationPanel
  deviceId={selectedDeviceId}
  onSettingsChange={(settings) => {
    // Update your queries with new settings
    queryClient.invalidateQueries(['optimized-positions']);
  }}
/>
```

## 📈 Monitoring Performance

Use the optimization performance hook:

```typescript
import { useOptimizationPerformance } from '@/hooks/use-optimized-traccar';

const { performanceData, recordOptimization } = useOptimizationPerformance();

// Record optimization results
useEffect(() => {
  if (result?.optimization) {
    recordOptimization(result.optimization);
  }
}, [result]);
```

## 🔄 Adaptive Optimization

Use adaptive optimization that adjusts settings based on device performance:

```typescript
import { useAdaptiveOptimization } from '@/hooks/use-optimized-traccar';

const { settings, stats } = useAdaptiveOptimization(deviceId);

// Use the adaptive settings in your queries
const { data: result } = useQuery({
  queryKey: ['adaptive-positions', deviceId, settings],
  queryFn: () => optimizedTraccarApi.getOptimizedPositions(deviceId, settings)
});
```

## 🛠️ Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `tolerance` | 10 | Douglas-Peucker tolerance in meters |
| `minSpeed` | 5 | Minimum speed in km/h to consider |
| `minTimeInterval` | 30000 | Minimum time between points (ms) |
| `maxSpeed` | 200 | Maximum realistic speed (km/h) |
| `minAccuracy` | 100 | Minimum GPS accuracy (meters) |
| `preserveStops` | true | Keep points where vehicle stopped |
| `preserveSpeedChanges` | true | Keep points with speed changes |

## 🚨 Fallback Behavior

The optimized API automatically falls back to direct Traccar API if the optimization service is unavailable:

```typescript
// This will work even if optimization service is down
const { data: result } = useQuery({
  queryKey: ['optimized-positions', deviceId],
  queryFn: () => optimizedTraccarApi.getOptimizedPositions(deviceId)
});

// result.optimization.reductionPercentage will be 0 if using fallback
```

## 📊 API Endpoints

The optimization service provides these endpoints:

- `GET /health` - Health check
- `GET /api/devices` - Get all devices
- `GET /api/positions?deviceId=123&optimize=true` - Get optimized positions
- `GET /api/history?deviceId=123&from=...&to=...` - Get optimized historical data
- `GET /api/optimization-stats/123` - Get optimization statistics

## 🔍 Testing

Test the optimization service:

```bash
# Test the service
curl http://localhost:3001/health

# Test optimization
curl "http://localhost:3001/api/positions?deviceId=123&optimize=true&tolerance=10"

# Test historical data
curl "http://localhost:3001/api/history?deviceId=123&from=2023-10-01T00:00:00Z&to=2023-10-01T23:59:59Z"
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `FRONTEND_URL` is set in the service `.env`
2. **Service Not Starting**: Check if port 3001 is available
3. **No Optimization**: Verify `optimize=true` parameter is included
4. **Memory Issues**: Reduce cache TTL or increase tolerance

### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in the service.

## 📚 Next Steps

1. **Monitor Performance**: Use the optimization panel to track performance
2. **Tune Settings**: Adjust tolerance and filters based on your data
3. **Scale Up**: Deploy the service to production with proper monitoring
4. **Advanced Features**: Implement custom optimization algorithms

## 🎯 Expected Results

With proper configuration, you should see:

- **50-80% reduction** in coordinate data
- **Faster map rendering** with smoother animations
- **Reduced bandwidth usage** especially on mobile
- **Better user experience** with responsive controls

The optimization service is designed to be transparent - your existing code will work with minimal changes while gaining significant performance benefits.



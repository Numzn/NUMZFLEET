# Coordinate Optimization Service

A middleware service that optimizes GPS coordinate data from Traccar using the Douglas-Peucker algorithm and other filtering techniques. This service sits between your frontend application and the hosted Traccar API to reduce data transfer and improve performance.

## Features

- **Douglas-Peucker Algorithm**: Reduces coordinate points while maintaining route shape
- **Speed-based Filtering**: Removes unrealistic speed data
- **Time-based Filtering**: Eliminates points too close in time
- **Accuracy Filtering**: Removes low-accuracy GPS points
- **Intelligent Point Preservation**: Keeps important points (stops, speed changes)
- **Caching**: Reduces API calls with intelligent caching
- **Multiple Optimization Levels**: Configurable tolerance settings

## Quick Start

1. **Install Dependencies**
   ```bash
   cd coordinate-optimization-service
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp env.example .env
   # Edit .env with your Traccar credentials
   ```

3. **Start the Service**
   ```bash
   npm run dev
   ```

4. **Test the Service**
   ```bash
   curl http://localhost:3001/health
   ```

## API Endpoints

### Health Check
```
GET /health
```

### Get Devices
```
GET /api/devices
```

### Get Optimized Positions
```
GET /api/positions?deviceId=123&optimize=true&tolerance=10
```

### Get Historical Data
```
GET /api/history?deviceId=123&from=2023-10-01T00:00:00Z&to=2023-10-01T23:59:59Z
```

### Get Optimization Statistics
```
GET /api/optimization-stats/123?days=7
```

## Optimization Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `tolerance` | 10 | Douglas-Peucker tolerance in meters |
| `minSpeed` | 5 | Minimum speed in km/h to consider |
| `minTimeInterval` | 30000 | Minimum time between points (ms) |
| `maxSpeed` | 200 | Maximum realistic speed (km/h) |
| `minAccuracy` | 100 | Minimum GPS accuracy (meters) |
| `preserveStops` | true | Keep points where vehicle stopped |
| `preserveSpeedChanges` | true | Keep points with speed changes |

## Integration with Frontend

Update your frontend to use the optimization service instead of direct Traccar API calls:

```javascript
// Before (direct Traccar API)
const positions = await fetch('https://fleet.numz.site/api/positions?deviceId=123');

// After (optimized service)
const response = await fetch('http://localhost:3001/api/positions?deviceId=123&optimize=true');
const { positions, optimization } = await response.json();
```

## Performance Benefits

- **50-80% data reduction** for typical GPS tracks
- **Faster map rendering** with fewer points
- **Reduced bandwidth usage** for mobile applications
- **Improved battery life** on mobile devices
- **Better user experience** with smoother animations

## Algorithm Details

### Douglas-Peucker Algorithm
The service uses the Douglas-Peucker algorithm to simplify line segments while preserving the essential shape of the route. Points are removed if they don't significantly deviate from a straight line between two other points.

### Advanced Filtering
- **Speed Filtering**: Removes points with unrealistic speeds (>200 km/h)
- **Time Filtering**: Eliminates points too close in time (<30 seconds)
- **Accuracy Filtering**: Removes low-accuracy GPS readings (>100m)
- **Smart Preservation**: Keeps important points like stops and speed changes

## Monitoring

The service provides detailed statistics about optimization:

```json
{
  "optimization": {
    "originalCount": 1000,
    "optimizedCount": 250,
    "reductionPercentage": 75.0,
    "statistics": {
      "accuracyFiltered": 50,
      "speedFiltered": 25,
      "timeFiltered": 100,
      "douglasPeuckerReduced": 575
    }
  }
}
```

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables
- `PORT`: Server port (default: 3001)
- `TRACCAR_URL`: Your Traccar server URL
- `TRACCAR_AUTH`: Base64 encoded credentials
- `FRONTEND_URL`: Frontend URL for CORS
- `CACHE_TTL`: Cache time-to-live in seconds

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `FRONTEND_URL` is set correctly
2. **Traccar Authentication**: Verify `TRACCAR_AUTH` is properly base64 encoded
3. **Memory Usage**: Adjust cache TTL for large datasets
4. **Performance**: Increase tolerance for better performance vs accuracy trade-off

### Debug Mode
Set `NODE_ENV=development` for detailed logging.

## License

MIT License - see LICENSE file for details.



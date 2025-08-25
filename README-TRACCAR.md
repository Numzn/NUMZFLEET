# Traccar GPS Integration Setup Guide

## 🚀 Quick Start

### 1. Environment Configuration

Create a `.env` file in your project root:

```bash
# Traccar Server Configuration
VITE_TRACCAR_URL=http://localhost:8082
VITE_TRACCAR_AUTH=YWRtaW46YWRtaW4=
VITE_USE_TRACCAR_SIMULATION=true
```

### 2. Generate Base64 Credentials

```bash
# For username:password authentication
echo -n "admin:admin" | base64
# Output: YWRtaW46YWRtaW4=
```

### 3. Restart Development Server

```bash
npm run dev
```

## 🔧 Configuration Options

### Simulation Mode (Default)
- **Purpose**: Testing without real Traccar server
- **Setting**: `VITE_USE_TRACCAR_SIMULATION=true`
- **Features**: Simulated devices with realistic Zambia coordinates

### Production Mode
- **Purpose**: Connect to real Traccar server
- **Setting**: `VITE_USE_TRACCAR_SIMULATION=false`
- **Requirements**: Running Traccar server with proper CORS

## 🌐 Traccar Server Setup

### Docker Installation (Recommended)
```bash
# Pull and run Traccar server
docker run -d \
  --name traccar \
  -p 8082:8082 \
  -p 5000-5150:5000-5150 \
  -p 5000-5150:5000-5150/udp \
  -v /etc/traccar:/etc/traccar \
  traccar/traccar:latest
```

### Manual Installation
1. Download from [traccar.org](https://www.traccar.org/download/)
2. Install and configure
3. Start the service
4. Access web interface at `http://localhost:8082`

## 🔍 Troubleshooting

### Common Issues

#### 1. Connection Failed Error
```
Error fetching Traccar devices: TypeError: Cannot read properties of undefined
```

**Solution**: 
- Check environment variables are set correctly
- Verify Traccar server is running
- Ensure CORS is configured on Traccar server

#### 2. CORS Errors
```
Access to fetch at 'http://localhost:8082/api/devices' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution**: Add CORS headers to Traccar server configuration

#### 3. Authentication Errors
```
Traccar API error: 401 Unauthorized
```

**Solution**: 
- Verify credentials are correct
- Check base64 encoding
- Ensure user has API access

### Debug Mode

Enable debug logging by checking browser console for:
```
Traccar Configuration: {
  TRACCAR_BASE_URL: "http://localhost:8082",
  TRACCAR_AUTH: "***",
  USE_SIMULATION: true,
  VITE_USE_TRACCAR_SIMULATION: "true"
}
```

## 📱 Features

### Live Tracking Interface
- **Interactive Map**: Custom map with vehicle markers
- **Traccar Interface**: Embedded Traccar web interface
- **Device Management**: Real-time device data and status

### Device Management
- **Search & Filter**: Find devices by name or ID
- **Status Filtering**: Show online/offline devices
- **Bulk Selection**: Select multiple devices
- **Real-time Updates**: Automatic data refresh

### Connection Monitoring
- **Status Indicator**: Real-time connection status
- **Device Statistics**: Total, online, and offline counts
- **Error Handling**: Comprehensive error messages
- **Auto-refresh**: Periodic connection testing

## 🔐 Security Considerations

### Production Deployment
1. **HTTPS**: Use HTTPS for both frontend and Traccar server
2. **Authentication**: Use strong credentials
3. **CORS**: Configure proper CORS policies
4. **Environment Variables**: Secure credential storage

### Environment Variables
```bash
# Production example
VITE_TRACCAR_URL=https://your-traccar-server.com
VITE_TRACCAR_AUTH=your_base64_encoded_credentials
VITE_USE_TRACCAR_SIMULATION=false
```

## 📊 API Endpoints

The integration uses these Traccar API endpoints:

- `GET /api/devices` - List all devices
- `GET /api/positions` - Get device positions
- `GET /api/devices/{id}` - Get specific device
- `GET /api/reports` - Get reports (future use)

## 🛠️ Development

### Adding New Features
1. **Extend TraccarClient**: Add new methods to `lib/traccar.ts`
2. **Create Hooks**: Add React Query hooks in `hooks/use-traccar.ts`
3. **Build Components**: Create UI components in `components/tracking/`
4. **Update Types**: Extend interfaces in `shared/schema.ts`

### Testing
```bash
# Test with simulation mode
VITE_USE_TRACCAR_SIMULATION=true npm run dev

# Test with real server
VITE_USE_TRACCAR_SIMULATION=false npm run dev
```

## 📞 Support

For issues with:
- **Traccar Server**: Check [Traccar Documentation](https://www.traccar.org/documentation/)
- **Integration**: Check browser console for debug logs
- **Configuration**: Verify environment variables

## 🎯 Next Steps

1. **Configure Real Server**: Set up Traccar server
2. **Map Vehicles**: Link vehicles to Traccar devices
3. **Enable Production**: Switch to production mode
4. **Monitor Performance**: Check connection status regularly


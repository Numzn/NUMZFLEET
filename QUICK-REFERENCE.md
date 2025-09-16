# Quick Reference Card

## 🚀 System Status: WORKING
- **GPS Data**: Real coordinates from Traccar
- **Location**: Lusaka, Zambia
- **Devices**: 4 active devices
- **Updates**: Every 10 seconds

## 🔧 Key Files
- **Main API**: `client/src/lib/traccar.ts`
- **Data Hook**: `client/src/components/tracking/map/useDeviceData.ts`
- **Map**: `client/src/components/tracking/map/TrackingMap.tsx`
- **Config**: `.env.local`

## 🌐 API Endpoints
- **Devices**: `https://fleet.numz.site/api/devices`
- **Positions**: `https://fleet.numz.site/api/positions`
- **Auth**: Basic Auth (numerinyirenda14@gmail.com:numz0099)

## 🎯 Main Functions
```typescript
// Get all devices with positions
const { devices, isLoading, error } = useDeviceData();

// Test API connection
await traccarApi.testConnection();

// Get specific device positions
await traccarApi.getPositions(deviceId);
```

## 🐛 Common Issues Fixed
1. ✅ DeviceId object error → Enhanced parameter handling
2. ✅ 404 positions API → Correct endpoint + headers
3. ✅ Fake coordinates → Real GPS data from Traccar
4. ✅ Data inconsistency → Single data source

## 📊 Real Device Data
- **Numz**: -15.3261456, 28.2755021
- **HELLEN**: -15.3854991, 28.2597316
- **GIFT**: -15.3386376, 28.2981562
- **CHARLES**: Offline (no recent position)

## 🔄 Data Flow
```
Traccar API → React Query → useDeviceData() → Map Components
     ↓              ↓              ↓              ↓
  Real GPS      Caching &      Process &      Display
  Coordinates   Background     Combine        Markers
                Updates        Data
```

---
**Last Updated**: January 15, 2025  
**Status**: ✅ OPERATIONAL





# Data Flow Diagram - Live Tracking System

## Current Data Flow (FIXED)

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Traccar API   │    │   React Query    │    │   Frontend      │
│                 │    │   (Caching)      │    │   Components    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │ 1. GET /api/devices    │                        │
         ├───────────────────────►│                        │
         │                        │                        │
         │ 2. GET /api/positions  │                        │
         ├───────────────────────►│                        │
         │                        │                        │
         │                        │ 3. useDeviceData()     │
         │                        ├───────────────────────►│
         │                        │                        │
         │                        │ 4. Process & Combine   │
         │                        │    devices + positions │
         │                        │                        │
         │                        │ 5. Return processed    │
         │                        │    Device[] with       │
         │                        │    real coordinates    │
         │                        ├───────────────────────►│
         │                        │                        │
         │                        │ 6. Update every 10s    │
         │                        │    (background)        │
         │                        │                        │
```

## Data Sources

### 1. Traccar API Endpoints
- **`/api/devices`** - Device information (name, status, lastUpdate, positionId)
- **`/api/positions`** - Real GPS coordinates (latitude, longitude, speed, course)

### 2. React Query Hooks
- **`useDeviceData()`** - Main data hook used by ALL components
- **Query Keys**: 
  - `['traccar-devices']` - Device data
  - `['traccar-positions']` - Position data
- **Refresh Interval**: 10 seconds
- **Stale Time**: 5 seconds

### 3. Frontend Components
- **`LiveTrackingNew`** - Main tracking page
- **`TrackingMap`** - Map component
- **`MapControls`** - Map control buttons
- **`DeviceMarkers`** - Device markers on map

## Data Processing

1. **Fetch Devices**: Get device list from Traccar
2. **Fetch Positions**: Get position data from Traccar
3. **Combine Data**: Match devices with their latest positions
4. **Process Coordinates**: Use real GPS coordinates (no fake data)
5. **Return Processed Data**: Device[] with position information

## Key Features

- ✅ **Single Data Source**: All components use `useDeviceData()`
- ✅ **Real GPS Data**: No fake coordinates
- ✅ **Background Updates**: 10-second refresh intervals
- ✅ **Error Handling**: Proper error states and retry logic
- ✅ **Caching**: React Query handles caching and deduplication

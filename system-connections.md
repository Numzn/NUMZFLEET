# System Connections Diagram

## Your Live Tracking System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────────┤
│  LiveTrackingNew.tsx                                           │
│  ├── useDeviceData() ──────────────────────────────────────────┐│
│  │                                                             ││
│  └── TrackingMap.tsx                                           ││
│      ├── MapContainer.tsx (Leaflet Map)                       ││
│      ├── DeviceMarkers.tsx                                    ││
│      ├── MapControls.tsx                                      ││
│      └── MapStatus.tsx                                        ││
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP Requests
                                │ (Basic Auth)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TRACCAR SERVER                              │
│                    https://fleet.numz.site                     │
├─────────────────────────────────────────────────────────────────┤
│  /api/devices     → Device info (name, status, lastUpdate)     │
│  /api/positions   → Real GPS coordinates (lat, lng, speed)     │
│  Authentication: Basic Auth (email:password base64)           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ (Optional - for vehicle data)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                           │
│                    (For vehicle management)                    │
├─────────────────────────────────────────────────────────────────┤
│  vehicles table → Vehicle details (name, model, type)          │
│  Authentication: Supabase API Key                             │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Connections

### 1. Frontend → Traccar (MAIN CONNECTION)
```
Frontend Components
    ↓
useDeviceData() hook
    ↓
React Query (caching)
    ↓
traccarApi.getDevices() + traccarApi.getPositions()
    ↓
HTTP GET requests to Traccar
    ↓
https://fleet.numz.site/api/devices
https://fleet.numz.site/api/positions
```

### 2. Authentication Flow
```
Frontend
    ↓
Environment Variables (.env.local)
    ↓
VITE_TRACCAR_URL = "https://fleet.numz.site"
VITE_TRACCAR_AUTH = "bnVtZXJpbnlpcmVuZGExNEBnbWFpbC5jb206bnVtejAwOTk="
    ↓
Basic Auth Header: "Authorization: Basic [base64]"
    ↓
Traccar Server (authenticates request)
```

### 3. Real-time Data Flow
```
Traccar Server (GPS devices sending data)
    ↓
Traccar Database (stores positions)
    ↓
Traccar API (/api/positions)
    ↓
Frontend (every 10 seconds)
    ↓
Map Display (real GPS coordinates)
```

## What's Actually Connected

### ✅ WORKING CONNECTIONS:
1. **Frontend ↔ Traccar API** - Main GPS data source
2. **React Query ↔ Traccar** - Data fetching and caching
3. **Map ↔ Real GPS Data** - Device locations in Lusaka, Zambia
4. **Authentication** - Basic Auth working correctly

### ⚠️ OPTIONAL CONNECTIONS:
1. **Frontend ↔ Supabase** - For vehicle management (not used for GPS)
2. **Traccar ↔ Supabase** - Not directly connected (separate systems)

## Key Points:
- **GPS Data**: Comes ONLY from Traccar API
- **Map Display**: Uses real coordinates from Traccar
- **No Fake Data**: All coordinates are real GPS positions
- **Real-time Updates**: Every 10 seconds from Traccar
- **Authentication**: Basic Auth with your Traccar credentials





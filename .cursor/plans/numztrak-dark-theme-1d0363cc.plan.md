<!-- 1d0363cc-fb80-44c3-89ed-bbfc93b609f3 8af9a890-fae3-4ef3-8a95-18806c1c64bd -->
# NumzTrak Fuel Management System - Detailed Implementation Plan

## Codebase Analysis Summary

### Current Architecture (What We Have)

```
NUMZFLEET/
├── backend/ (Docker containers)
│   ├── (obsolete layout) old backend/docker-compose.yml listed mysql, traccar, nginx, etc.
│   ├── conf/traccar.xml (GPS protocols on ports 5000-5250)
│   └── nginx.conf (HTTPS proxy to Traccar)
│
├── traccar-fleet-system/frontend/ (NumzTrak Dashboard - React)
│   ├── src/
│   │   ├── store/ (Redux: devices, sessions, events, groups, drivers, maintenances, calendars)
│   │   ├── dashboard/ (NEW - your Fleet Manager Dashboard)
│   │   ├── main/ (Map view with device list)
│   │   ├── settings/ (Device/User/Group management pages)
│   │   ├── reports/ (Various fleet reports)
│   │   ├── CachingController.js (Fetches geofences, groups, drivers, maintenances, calendars on auth)
│   │   ├── SocketController.jsx (WebSocket: devices, positions, events real-time)
│   │   └── common/util/fetchOrThrow.js (Standard API call wrapper)
│   ├── vite.config.js (Proxy: /api/* → localhost:8082 Traccar)
│   └── package.json (React 19, Redux Toolkit, Material-UI 7, MapLibre)
│
└── data/ (Docker volumes - MySQL, Traccar logs)
```

### Established Patterns (Follow These)

**1. API Data Fetching:**

```javascript
// Pattern from CachingController.js:
const response = await fetchOrThrow('/api/endpoint');
dispatch(someActions.refresh(await response.json()));
```

**2. Redux Store Pattern:**

```javascript
// Pattern from store/devices.js:
const { reducer, actions } = createSlice({
  name: 'devices',
  initialState: { items: {}, selectedId: null },
  reducers: { refresh, update, selectId, remove }
});
```

**3. WebSocket Updates:**

```javascript
// Pattern from SocketController.jsx:
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.devices) dispatch(devicesActions.update(data.devices));
  // Add: if (data.fuelRequests) dispatch(fuelRequestsActions.update(data.fuelRequests));
};
```

**4. Dashboard Component Pattern:**

```javascript
// Pattern from dashboard/components/KPICards.jsx:
- Use makeStyles for styling
- useSelector to get data from Redux
- useMemo for calculations
- Material-UI Card, Grid, Typography
```

## PHASE 1: Foundation (Week 1-4)

### Week 1: Microservice Setup

**1.1 Create fuel-api Directory**

```
NUMZFLEET/fuel-api/
├── package.json
├── .env
├── Dockerfile
├── .dockerignore
└── src/
    ├── server.js
    ├── config/
    │   ├── database.js (PostgreSQL via Sequelize)
    │   └── traccar.js (MySQL read-only connection)
    ├── models/ (Sequelize models)
    ├── routes/
    ├── controllers/
    ├── middleware/auth.js
    └── socket/socketHandler.js
```

**1.2 package.json Dependencies**

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "sequelize": "^6.35.1",
    "mysql2": "^3.6.5",
    "socket.io": "^4.6.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "bcrypt": "^5.1.1"
  }
}
```

**1.3 PostgreSQL Schema**

File: `fuel-api/src/models/FuelRequest.js`

```javascript
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('FuelRequest', {
    deviceId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    currentFuelLevel: DataTypes.DOUBLE,
    requestedAmount: DataTypes.DOUBLE,
    reason: DataTypes.STRING,
    urgency: { type: DataTypes.ENUM('normal', 'urgent', 'emergency'), defaultValue: 'normal' },
    latitude: DataTypes.DOUBLE,
    longitude: DataTypes.DOUBLE,
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected', 'fulfilled', 'cancelled'), defaultValue: 'pending' },
    reviewerId: DataTypes.INTEGER,
    notes: DataTypes.TEXT
  });
};
```

**1.4 Update docker-compose.yml**

File: root `docker-compose.yml` (stack is defined at repo root; `backend/docker-compose.yml` is obsolete).

Historical note — this plan referenced inserting after `traccar-admin`; reconcile with current root compose if applying:

```yaml
  fuel-postgres:
    image: postgres:15-alpine
    container_name: fuel-postgres
    environment:
      POSTGRES_DB: numztrak_fuel
      POSTGRES_USER: numztrak
      POSTGRES_PASSWORD: NumzFuel2025
    volumes:
      - ../data/fuel-postgres:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - traccar-net
    restart: unless-stopped

  fuel-api:
    build: ../fuel-api
    container_name: fuel-api
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://numztrak:NumzFuel2025@fuel-postgres:5432/numztrak_fuel
      TRACCAR_MYSQL_URL: mysql://traccar:traccar123@traccar-mysql:3306/traccar
      PORT: 3001
      NODE_ENV: production
    depends_on:
      - fuel-postgres
      - traccar-mysql
    networks:
      - traccar-net
    restart: unless-stopped
```

### Week 2: API Endpoints

**2.1 Authentication Middleware**

File: `fuel-api/src/middleware/auth.js`

```javascript
// Validate Traccar session by querying tc_users table
// Check if user is manager (admin) or driver
// Attach user info to req.user
```

**2.2 Fuel Request Controller**

File: `fuel-api/src/controllers/fuelRequestController.js`

```javascript
create()    // Driver creates request
list()      // Manager/driver lists (filtered by role)
getById()   // Get single request
approve()   // Manager approves (status → approved)
reject()    // Manager rejects (status → rejected)
cancel()    // Driver cancels
fulfill()   // Mark as fulfilled
```

**2.3 WebSocket Handler**

File: `fuel-api/src/socket/socketHandler.js`

```javascript
io.on('connection', (socket) => {
  // Join room based on role: 'managers' or 'driver-{userId}'
  // Emit: 'fuel-request-created', 'fuel-request-updated'
});
```

### Week 3: Dashboard Integration

**3.1 Create Redux Slice**

File: `traccar-fleet-system/frontend/src/store/fuelRequests.js` (NEW)

Copy pattern from `store/devices.js`, modify for fuel requests

**3.2 Update Store Index**

File: `traccar-fleet-system/frontend/src/store/index.js`

Lines 9-10: Add import

Line 23: Add to combineReducers

Line 34: Export fuelRequestsActions

**3.3 Add to CachingController**

File: `traccar-fleet-system/frontend/src/CachingController.js`

After line 45, add:

```javascript
useEffectAsync(async () => {
  if (authenticated) {
    const response = await fetchOrThrow('/api/fuel-requests');
    dispatch(fuelRequestsActions.refresh(await response.json()));
  }
}, [authenticated]);
```

**3.4 Update SocketController**

File: `traccar-fleet-system/frontend/src/SocketController.jsx`

In socket.onmessage (line 81-95), add:

```javascript
if (data.fuelRequests) {
  dispatch(fuelRequestsActions.update(data.fuelRequests));
}
```

**3.5 Add Vite Proxy**

File: `traccar-fleet-system/frontend/vite.config.js`

After line 26, add:

```javascript
'/api/fuel-requests': {
  target: 'http://127.0.0.1:3001',
  changeOrigin: true,
  secure: false,
},
```

**3.6 Create Fuel Requests Card**

File: `traccar-fleet-system/frontend/src/dashboard/components/FuelRequestsCard.jsx` (NEW)

- Pattern similar to `AlertsFuel.jsx` (2-column layout)
- Material-UI components matching existing theme
- Left column: Pending requests list
- Right column: Request statistics
- Approve/Reject buttons with confirmation

**3.7 Integrate into Dashboard**

File: `traccar-fleet-system/frontend/src/dashboard/DashboardPage.jsx`

After line 177 (after MaintenanceDrivers section), add:

```jsx
<div className={classes.section}>
  <FuelRequestsCard devices={filteredDevices} positions={filteredPositions} />
</div>
```

### Week 4: Driver App Integration

**Files in your React Native driver app:**

- Add FuelRequestScreen with fuel gauge and submit button
- Integrate with fuel-api endpoints
- Show request status with real-time updates

## Key Integration Points

### Data Flow for Fuel Requests

```
Driver App → POST /api/fuel-requests → fuel-api → PostgreSQL
                                            ↓
                                      WebSocket emit
                                            ↓
Manager Dashboard ← Socket update ← fuel-api
                                            ↓
                                    Manager approves
                                            ↓
                                      PUT /api/fuel-requests/:id
                                            ↓
                                      WebSocket emit
                                            ↓
Driver App ← Socket update ← Status changed to "approved"
```

### Authentication Flow

```
1. User logs in via Traccar (/api/session)
2. Traccar session cookie stored
3. fuel-api validates cookie against tc_users table
4. Checks user.administrator field (manager) vs regular (driver)
5. Returns appropriate data and permissions
```

## Benefits of This Approach

✅ Traccar remains completely untouched (no custom builds)

✅ Follows existing codebase patterns (Redux, WebSocket, Material-UI)

✅ Reuses authentication (Traccar session)

✅ Scalable architecture (separate microservice)

✅ Easy to test and deploy incrementally

✅ Can add features without affecting GPS tracking

### To-dos

- [ ] Update palette.js with NumzTrak colors (navy backgrounds, cyan accents)
- [ ] Update components.js with glass effects and professional styling
- [ ] Update LoginLayout.jsx with dark background and gradient sidebar
- [ ] Update AppThemeProvider.jsx to always use dark mode
- [ ] Test all pages and features to ensure functionality is intact
---
name: Fuel API Backend Integration Plan
overview: ""
todos:
  - id: e883b6ac-4f9a-4b70-9edd-656f6d3aba01
    content: Add socket.io-client to package.json dependencies
    status: pending
  - id: b9b8262f-8e30-4713-a448-56bdeecb0578
    content: Restart the frontend service (e.g. docker compose restart frontend from repo root)
    status: pending
---

# Fuel API Backend Integration Plan

## Overview

Integrate driver app with existing Fuel API (Node.js/PostgreSQL) for production-ready fuel request management. The Fuel API already exists and is running - we just need to create comprehensive documentation and integration code for the mobile driver app.

## Current State

**Existing Fuel API (Already Running):**

- Node.js/Express server on port 3000 (root compose service `backend`)
- PostgreSQL database with fuel_requests table
- REST endpoints: POST, GET, DELETE, PUT
- Authentication middleware (session + header-based)
- Automated fuel validation
- WebSocket support ready
- Accessible via Nginx at `/api/fuel-requests`

**What's Needed:**

- Complete integration documentation
- Mobile app service layer code
- React Native UI components
- Testing examples

## Implementation Phases

### Phase 1: Backend Documentation (PRIORITY - DO THIS FIRST)

#### 1.1 Create Complete Integration Guide

**File**: `backend/DRIVER-APP-FUEL-API-INTEGRATION.md`

Complete guide covering:

- Quick start (3 minutes to test)
- Authentication setup (Traccar session + dev mode)
- Fuel request workflow (create, monitor, cancel)
- Complete FuelAPIService.js code
- Complete FuelRequestScreen.jsx UI component
- WebSocket integration for real-time updates
- Error handling patterns
- Testing guide
- Production checklist
- Troubleshooting

#### 1.2 Create API Reference

**File**: `backend/FUEL-API-REFERENCE.md`

Detailed API documentation:

- **POST** `/api/fuel-requests` - Create fuel request
  - Request body: `{ deviceId, requestedAmount, reason, urgency }`
  - Response: Full request object with validation
  - Auto-validation: Checks capacity, fuel level

- **GET** `/api/fuel-requests` - List driver's requests
  - Auto-filtered by driver role
  - Returns only driver's own requests

- **GET** `/api/fuel-requests/:id` - Get request details
  - Includes validation warnings
  - Shows manager approval/rejection

- **GET** `/api/fuel-requests/:id/validation` - Get validation details
  - Vehicle capacity info
  - Suggested amounts
  - Warnings

- **DELETE** `/api/fuel-requests/:id` - Cancel pending request
  - Only driver's own requests
  - Only if status is 'pending'

- **PUT** `/api/fuel-requests/:id/fulfill` - Mark as fulfilled
  - Update status to 'fulfilled'
  - Record fulfillment time

#### 1.3 Create Visual Flow Diagrams

**File**: `backend/FUEL-REQUEST-FLOW-DIAGRAM.md`

ASCII diagrams showing:

- Driver App → Fuel API connection flow
- Authentication flow (session cookie vs header)
- Request lifecycle (pending → approved → fulfilled → cancelled)
- WebSocket event flow
- Database vs Traccar attributes comparison

### Phase 2: Mobile App Code Examples

#### 2.1 Complete Service Layer

**Provide**: `FuelAPIService.js` - Production-ready service

```javascript
class FuelAPIService {
  // Authentication
  async loginWithTraccar(email, password)
  async loginWithDevUserId(userId)
  async checkSession()
  
  // Fuel Request Operations (Fuel API)
  async createFuelRequest(deviceId, requestedAmount, reason, urgency)
  async getMyFuelRequests()
  async getFuelRequestDetails(requestId)
  async getRequestValidation(requestId)
  async cancelFuelRequest(requestId)
  async markFuelRequestFulfilled(requestId)
  
  // Real-time Updates
  connectWebSocket()
  subscribeToRequestUpdates(callback)
  disconnectWebSocket()
  
  // Utility
  async getAssignedDevices()
  async getCurrentFuelLevel(deviceId)
  async logout()
}
```

#### 2.2 Complete UI Component

**Provide**: `FuelRequestScreen.jsx` - React Native component

Features:

- Device/vehicle selection dropdown
- Current fuel level display
- Fuel request form with validation
- Real-time pending request display
- Status updates via WebSocket
- Validation warnings display
- Request history view
- Cancel button for pending requests
- Loading states and error handling
- Professional styling

### Phase 3: Backend Verification

#### 3.1 Verify Nginx Configuration

**File**: `backend/nginx.conf`

Ensure correct routing:

```nginx
location /api/fuel-requests {
    proxy_pass http://backend:3000/api/fuel-requests;
    # ... proxy settings
}
```

#### 3.2 Verify Authentication Middleware

**File**: `fuel-api/src/middleware/auth.js`

Confirm supports:

- Traccar session cookie (JSESSIONID)
- Development header (x-user-id)
- Driver role filtering

### Phase 4: Testing Documentation

#### 4.1 Testing Examples

Provide examples for:

- Unit testing service methods
- Integration testing API calls
- UI component testing
- WebSocket event testing
- Mock data for development

## Key Benefits of Fuel API Integration

✅ **Automated Validation** - Checks vehicle capacity, validates amounts

✅ **Real-time Notifications** - WebSocket updates for approvals/rejections

✅ **Database Storage** - PostgreSQL with full querying capabilities

✅ **Manager Workflow** - Web dashboard for approval/rejection (already exists)

✅ **Advanced Analytics** - Proper reporting and statistics

✅ **Scalable** - Handles high volume of requests

✅ **Production-Ready** - Already running and tested in your system

## Fuel API vs Traccar Attributes

| Feature | Traccar Attributes | Fuel API (PostgreSQL) |

|---------|-------------------|----------------------|

| Storage | JSON in device attrs | PostgreSQL database |

| Querying | Limited | Full SQL queries |

| Validation | Manual | Automated |

| Notifications | None | WebSocket real-time |

| Analytics | Basic | Advanced |

| Scalability | Limited | High |

| Manager UI | Traccar web | Dashboard |

## Success Criteria

1. ✅ Update MOBILE-APP-CONFIG.md with FuelRequestService (COMPLETED)
2. 📝 Create DRIVER-APP-FUEL-API-INTEGRATION.md with complete guide
3. 📝 Create FUEL-API-REFERENCE.md with endpoint documentation
4. 📊 Create FUEL-REQUEST-FLOW-DIAGRAM.md with visual flows
5. 💻 Provide complete FuelAPIService.js code
6. 🎨 Provide complete FuelRequestScreen.jsx UI component
7. 🧪 Provide testing examples
8. ✅ Verify Nginx routing configuration
9. ✅ Verify authentication middleware compatibility
10. ✅ All code is production-ready and copy-paste ready

## Files to Create/Modify

### Documentation (Priority - Do These First)

1. 📝 **CREATE**: `backend/DRIVER-APP-FUEL-API-INTEGRATION.md` (~1000 lines)
2. 📝 **CREATE**: `backend/FUEL-API-REFERENCE.md` (~300 lines)
3. 📊 **CREATE**: `backend/FUEL-REQUEST-FLOW-DIAGRAM.md` (~200 lines)

### Code Examples (Provide as Documentation)

4. 💻 **PROVIDE**: `FuelAPIService.js` - Complete service (~500 lines)
5. 🎨 **PROVIDE**: `FuelRequestScreen.jsx` - Complete UI (~400 lines)
6. 🧪 **PROVIDE**: Testing examples (~200 lines)

### Backend Verification (Check Existing Files)

7. ✅ **VERIFY**: `backend/nginx.conf` - Routing is correct
8. ✅ **VERIFY**: `fuel-api/src/middleware/auth.js` - Auth methods work
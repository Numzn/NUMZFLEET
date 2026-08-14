# SaaS Frontend Layer Implementation

## Overview

The NUMZFLEET SaaS management layer has been implemented on top of the existing fleet application. This layer provides organization hierarchy management while preserving the existing dashboard and fleet modules.

## Architecture

```
┌─────────────────────────────────────────┐
│ NUMZFLEET                                │
│                                         │
│ ContextSelector (Dropdown)               │ ← NEW: Organization switcher
├─────────────────────────────────────────┤
│ SaaS Navigation  │ Existing Fleet App   │ ← Split navigation
│                  │                      │
│ • Overview       │ Dashboard            │
│ • Partners       │ Vehicles             │
│ • Direct Cust.   │ Tracking             │
│                  │ Fuel/Maint/Reports  │
│                  │                      │
└─────────────────────────────────────────┘
```

## Implemented Components

### 1. Redux Store (`src/store/organizations.js`)
Manages organization context and data:
- `currentContext`: Currently selected organization (Platform/Partner/Customer)
- `partners`: List of partner organizations
- `directCustomers`: List of direct customer organizations
- `partnerCustomers`: Customers nested under each partner
- `overview`: Platform-wide aggregate statistics

### 2. API Layer (`src/saas/organizationApi.js`)
HTTP client functions for backend endpoints:
- `fetchPartners()` → GET /api/partners
- `fetchDirectCustomers()` → GET /api/direct-customers
- `fetchPartnerCustomers(partnerId)` → GET /api/partners/:partnerId/customers
- `fetchPlatformOverview()` → GET /api/platform/overview
- `createPartner(data)` → POST /api/partners
- `createDirectCustomer(data)` → POST /api/direct-customers
- `createPartnerCustomer(partnerId, data)` → POST /api/partners/:partnerId/customers
- `switchContext(companyId)` → POST /api/context/switch/:companyId
- `fetchMyCustomers()` → GET /api/my-customers
- `createMyCustomer(data)` → POST /api/my-customers

### 3. Context Selector Component (`src/saas/components/ContextSelector.jsx`)
- Dropdown showing current organization context
- Different menu options based on user type:
  - **Platform**: Shows all partners and direct customers
  - **Partner**: Shows own customers
  - **Customer**: Shows fleet only
- Handles context switching via backend API
- Integrated into the top navigation bar

### 4. SaaS Sidebar (`src/saas/components/SaaSSidebar.jsx`)
- Navigation menu that changes based on current context
- Platform: Overview, Partners, Direct Customers
- Partner: My Customers
- Customer: Dashboard (falls through to existing fleet)

### 5. Pages

#### Platform Overview (`src/saas/pages/PlatformOverviewPage.jsx`)
Shows:
- Partner count
- Direct customer count
- Partner customer count
- Total customer aggregate
- Organization hierarchy diagram

#### Partners Page (`src/saas/pages/PartnersPage.jsx`)
- List all partners
- Create new partners
- Card-based UI showing customer count per partner
- Form validation for name/slug uniqueness

#### Direct Customers Page (`src/saas/pages/DirectCustomersPage.jsx`)
- List all direct customers
- Create new direct customers
- Card-based UI showing device/vehicle counts
- Form validation for name/slug uniqueness

### 6. Context Hook (`src/hooks/useOrganizationContext.js`)
- Initializes organization context on app load
- Determines user type (Platform/Partner/Customer) based on user.administrator flag
- Loads organization data asynchronously
- Handles errors gracefully

## Routes

New routes added to `src/Navigation.jsx`:
```
/saas/platform/overview    → Platform aggregated stats
/saas/platform/partners     → Partner management
/saas/platform/direct-customers → Direct customer management
```

Partner routes (ready for implementation):
```
/saas/partner/customers     → My customers (when user context = partner)
```

## Integration Points

### 1. Redux Store
Added to `src/store/index.js`:
- Imported organizations reducer
- Added to combineReducers
- Exported all actions

### 2. Top Navigation Bar
Updated `src/common/components/UnifiedShell.jsx`:
- Imported ContextSelector
- Added to topbar between menu button and page title
- Displays on all pages (except live map)

### 3. App Initialization
Updated `src/App.jsx`:
- Imported useOrganizationContext hook
- Called hook after user is authenticated
- Initializes organization context on login

### 4. Navigation Routes
Updated `src/Navigation.jsx`:
- Imported new SaaS pages
- Added three routes under UnifiedShell
- Routes available after login

## Data Flow

1. **On Login:**
   - App.jsx calls useOrganizationContext(user)
   - Hook checks user.administrator flag
   - If platform admin: loads partners, direct customers, overview
   - Dispatches setCurrentContext, setPartners, setDirectCustomers, setOverview

2. **Context Selector Interaction:**
   - User clicks dropdown
   - Menu shows organizations based on current context
   - User selects organization
   - Calls switchContext(companyId) API
   - Updates Redux with new context
   - Menu items refresh for new context

3. **Navigation:**
   - SaaSSidebar reads currentContext from Redux
   - Shows different menu items based on context type
   - Links to /saas/platform/*, /saas/partner/*, etc.
   - Pages fetch data and dispatch to Redux

## User Experience Flow

### Platform Admin
1. Login → sees "NUMZ Platform" context
2. Context selector shows all Partners and Direct Customers
3. Can navigate to:
   - Overview (aggregate stats)
   - Partners (manage partner orgs)
   - Direct Customers (manage direct customers)
4. Click a Partner → context switches to that Partner
5. Now context selector shows that Partner's customers
6. Can navigate to that Partner's dashboard

### Partner User
1. Login → sees "Posh Media" context automatically
2. Context selector shows their own customers
3. Can navigate to:
   - My Customers page
   - Select a customer → switches to customer context
4. Can then access that customer's fleet dashboard

### Customer User
1. Login → sees "ABC Logistics" context automatically
2. Context selector shows only current context
3. Dashboard link takes them to fleet (existing app)

## Testing Checklist

- [ ] Frontend builds without errors
- [ ] Login loads org context correctly
- [ ] Context selector appears in top bar
- [ ] Platform admin sees partners + direct customers dropdown
- [ ] Partner users see their customers in dropdown
- [ ] Navigate to /saas/platform/overview loads page
- [ ] Navigate to /saas/platform/partners loads page
- [ ] Navigate to /saas/platform/direct-customers loads page
- [ ] Create partner form works and validates
- [ ] Create direct customer form works and validates
- [ ] Context switching updates state and sidebar
- [ ] Error handling works (API failures, validation)
- [ ] Mobile responsive (drawer nav, dropdown position)

## Future Enhancements

1. **Partner Customers Page** (`/saas/partner/customers`)
   - List customers under a partner
   - Create new customers under partner
   - Edit/delete customers

2. **Customer Context**
   - Pass companyId to fleet queries
   - Scope vehicles/devices to customer
   - Update reports/dashboards with tenant filter

3. **Audit Trail**
   - Log context switches
   - Track organization management actions

4. **Permissions UI**
   - Manage user roles per organization
   - Team member invitations

5. **Billing**
   - Subscription tier per organization
   - Usage analytics

## Files Created

### Store
- `src/store/organizations.js` - Redux slice

### API
- `src/saas/organizationApi.js` - Backend API calls

### Components
- `src/saas/components/ContextSelector.jsx` - Context dropdown
- `src/saas/components/SaaSSidebar.jsx` - SaaS navigation menu

### Pages
- `src/saas/pages/PlatformOverviewPage.jsx`
- `src/saas/pages/PartnersPage.jsx`
- `src/saas/pages/DirectCustomersPage.jsx`

### Hooks
- `src/hooks/useOrganizationContext.js` - Context initialization

## Files Modified

### Store
- `src/store/index.js` - Added organizations reducer and exports

### Navigation
- `src/Navigation.jsx` - Added SaaS route definitions

### Shell
- `src/common/components/UnifiedShell.jsx` - Integrated ContextSelector

### App
- `src/App.jsx` - Initialize organization context on login

## Next Steps

1. **Verify Build** - Run `npm run build` in frontend directory
2. **Test Context Flow** - Login and verify context selector appears
3. **Test API Calls** - Ensure backend endpoints are reachable
4. **Mobile Testing** - Test context selector on mobile devices
5. **Connect Fleet Scope** - Update vehicle queries to use currentContext.companyId
6. **Add Audit Logging** - Log context switches and org management actions

## Notes

- All components use Material-UI and follow existing design patterns
- Redux store uses Redux Toolkit slices for modern patterns
- Error handling uses existing error utilities
- API calls use existing traccarFetch utility for session/auth
- Mobile responsive with collapsible sidebar
- Context is initialized automatically on login
- No breaking changes to existing fleet modules

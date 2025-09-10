# 🔐 NUMZFLEET Authentication System

## 📋 Overview

This document provides a complete reference for the authentication system in NUMZFLEET. The system uses **Supabase Auth** with a clean, simplified implementation that follows best practices.

## 🏗️ Architecture

### Core Components

```
client/src/
├── hooks/
│   └── useAuth.tsx          # Main authentication hook
├── components/auth/
│   └── SimpleLoginForm.tsx  # Login/signup form
├── lib/
│   └── supabase.ts          # Supabase client configuration
└── App.tsx                  # Main app with auth routing
```

## 🔧 Setup & Configuration

### Environment Variables

**File:** `.env` (project root)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://yyqvediztsrlugentoca.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cXZlZGl6dHNybHVnZW50b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTM1NTUsImV4cCI6MjA3MTk2OTU1NX0.jAw3r078GtGTKkrLBXSvENKO3US3gHLp_RoYbZt5HOM

# Development Settings
VITE_APP_ENV=development
VITE_APP_NAME=NUMZFLEET
VITE_APP_VERSION=1.0.0

# Traccar Configuration
VITE_TRACCAR_URL=http://localhost:8082
VITE_TRACCAR_USERNAME=admin
VITE_TRACCAR_PASSWORD=admin

# Local Development URLs
VITE_API_URL=http://localhost:3000
VITE_APP_URL=http://localhost:5180
```

## 🎯 Authentication Hook (`useAuth.tsx`)

### Interface

```typescript
interface AuthContextType {
  user: User | null;           // Supabase user object
  session: Session | null;     // Current session
  isLoading: boolean;          // Loading state
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

### Usage

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, session, isLoading, signIn, signUp, signOut } = useAuth();

  // Check if user is authenticated
  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;

  return (
    <div>
      <p>Welcome, {user.email}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

## 🔑 Authentication Functions

### `signIn(email, password)`
- **Purpose:** Authenticate existing user
- **Returns:** Promise<void>
- **Throws:** Error if authentication fails
- **Toast:** Shows success/error messages

```typescript
try {
  await signIn('user@example.com', 'password123');
  // User is now authenticated
} catch (error) {
  console.error('Login failed:', error.message);
}
```

### `signUp(email, password)`
- **Purpose:** Create new user account
- **Returns:** Promise<void>
- **Throws:** Error if signup fails
- **Note:** User must verify email before first login

```typescript
try {
  await signUp('newuser@example.com', 'password123');
  // Account created, check email for verification
} catch (error) {
  console.error('Signup failed:', error.message);
}
```

### `signOut()`
- **Purpose:** Sign out current user
- **Returns:** Promise<void>
- **Effect:** Clears session and redirects to login

```typescript
try {
  await signOut();
  // User is now signed out
} catch (error) {
  console.error('Signout failed:', error.message);
}
```

## 🎨 Login Form Component

### `SimpleLoginForm.tsx`

**Features:**
- ✅ Sign in / Sign up toggle
- ✅ Email and password validation
- ✅ Loading states
- ✅ Error handling with toast notifications
- ✅ Beautiful gradient background

**Usage:**
```typescript
import { SimpleLoginForm } from '@/components/auth/SimpleLoginForm';

// Automatically used in App.tsx when user is not authenticated
```

## 🚦 App Routing Logic

### Authentication Flow

```typescript
// App.tsx
function AppContent() {
  const { user, isLoading } = useAuth();

  // 1. Show loading spinner while checking auth
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // 2. Show login form if not authenticated
  if (!user) {
    return <SimpleLoginForm />;
  }

  // 3. Show main app if authenticated
  return <MainApp />;
}
```

## 🔄 Session Management

### Automatic Session Handling

- **Session Persistence:** Supabase automatically persists sessions in localStorage
- **Auto Refresh:** Tokens are automatically refreshed
- **Session Restoration:** Sessions are restored on page refresh
- **Auth State Changes:** App automatically responds to auth state changes

### Session Lifecycle

1. **App Start:** Check for existing session
2. **User Login:** Create new session
3. **Page Refresh:** Restore existing session
4. **User Logout:** Clear session
5. **Token Expiry:** Auto-refresh or redirect to login

## 🛡️ Security Features

### Built-in Security
- ✅ **PKCE Flow:** Secure authentication flow
- ✅ **JWT Tokens:** Secure session tokens
- ✅ **HTTPS Only:** All communication encrypted
- ✅ **Email Verification:** Required for new accounts
- ✅ **Password Validation:** Enforced by Supabase

### Best Practices Implemented
- ✅ **No Auto Account Creation:** Prevents security vulnerabilities
- ✅ **Proper Error Handling:** No sensitive data exposure
- ✅ **Session Validation:** Regular session health checks
- ✅ **Secure Storage:** Tokens stored securely in localStorage

## 📱 User Interface

### Login Form Features
- **Responsive Design:** Works on all screen sizes
- **Accessibility:** Proper labels and keyboard navigation
- **Visual Feedback:** Loading states and error messages
- **Theme Integration:** Matches app design system

### Navigation Integration
- **User Info Display:** Shows user email in header
- **Sign Out Button:** Available in header and sidebar
- **Session Status:** Visual indicators for auth state

## 🔧 Development Commands

### Test Authentication
```bash
# Test Supabase connection
node scripts/test-auth.js

# Start development server
npm run dev
```

### Available URLs
- **Development:** http://localhost:5180/
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Traccar:** http://localhost:8082

## 🚨 Troubleshooting

### Common Issues

#### 1. Environment Variables Not Loading
```bash
# Check if .env file exists in project root
ls -la .env

# Verify Vite is loading env vars
# Look for: "🔍 Vite env loading: { hasUrl: true, hasKey: true }"
```

#### 2. Authentication Fails
```bash
# Check Supabase connection
node scripts/test-auth.js

# Verify credentials in Supabase dashboard
# Check if user exists and is verified
```

#### 3. Session Not Persisting
```bash
# Clear browser storage
localStorage.clear();
sessionStorage.clear();

# Check Supabase client configuration
# Verify storage settings in supabase.ts
```

### Debug Information

**Console Logs to Watch:**
- `🔍 Supabase initialization:` - Client setup
- `✅ Supabase client created successfully` - Connection established
- `🔐 Starting login process for:` - Login attempt
- `✅ User authenticated successfully` - Login success

## 📚 API Reference

### Supabase Client
```typescript
import { supabase } from '@/lib/supabase';

// Direct Supabase access (if needed)
const { data, error } = await supabase.auth.getUser();
const { data, error } = await supabase.auth.getSession();
```

### User Object Structure
```typescript
interface User {
  id: string;
  email?: string;
  created_at: string;
  updated_at: string;
  // ... other Supabase user properties
}
```

## 🔮 Future Enhancements

### Planned Features
- [ ] **Role-Based Access Control (RBAC)**
- [ ] **Password Reset Flow**
- [ ] **Social Login (Google, GitHub)**
- [ ] **Two-Factor Authentication (2FA)**
- [ ] **Session Management Dashboard**
- [ ] **User Profile Management**

### Integration Points
- [ ] **Admin Panel Integration**
- [ ] **Vehicle Management Permissions**
- [ ] **Reporting Access Control**
- [ ] **API Endpoint Protection**

## 📞 Support

### When Authentication Issues Arise

1. **Check this README first**
2. **Verify environment variables**
3. **Test with `scripts/test-auth.js`**
4. **Check browser console for errors**
5. **Verify Supabase dashboard status**

### Key Files to Reference
- `client/src/hooks/useAuth.tsx` - Main auth logic
- `client/src/lib/supabase.ts` - Supabase configuration
- `client/src/App.tsx` - Auth routing
- `.env` - Environment variables

---

## 🎯 Quick Reference

### Essential Commands
```bash
# Start app
npm run dev

# Test auth
node scripts/test-auth.js

# Check env vars
cat .env
```

### Key Functions
```typescript
const { user, signIn, signUp, signOut } = useAuth();
```

### Test Credentials
- **Email:** admin@numzfleet.com
- **Password:** admin1234

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready

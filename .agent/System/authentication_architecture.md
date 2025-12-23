# Authentication Architecture - DevHive React Frontend

## Overview

The authentication system uses a dual-token approach with automatic token refresh and session persistence. This document describes the complete authentication flow, token management, and security measures.

## Architecture Summary

- **Dual-token system**: Access tokens (JWT, 24h) + HTTP-only refresh tokens (7d)
- **In-memory + localStorage token management** with automatic refresh
- **React Query for data caching** with WebSocket-driven invalidation
- **Real-time cache synchronization** via WebSocket connections
- **User-scoped project selection** to prevent cross-account data leakage

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          React Application                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │   AuthContext   │  │   QueryClient   │  │  WebSocket Service  │  │
│  │  (Auth State)   │  │  (React Query)  │  │ (Cache Invalidation)│  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                      │             │
│  ┌────────▼────────────────────▼──────────────────────▼──────────┐  │
│  │                        apiClient.ts                           │  │
│  │              (Axios Instance + Interceptors)                  │  │
│  └───────────────────────────┬───────────────────────────────────┘  │
├──────────────────────────────┼──────────────────────────────────────┤
│                              │                                      │
│  ┌───────────────────────────▼───────────────────────────────────┐  │
│  │                      localStorage                              │  │
│  │  - token (access token)                                        │  │
│  │  - userId                                                      │  │
│  │  - tokenExpiration                                             │  │
│  │  - selectedProjectId:{userId}                                  │  │
│  │  - REACT_QUERY_OFFLINE_CACHE                                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Backend API                                 │
│  - REST API (HTTPS)                                                  │
│  - WebSocket (WSS) for real-time cache invalidation                 │
│  - HTTP-only refresh token cookies                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Token Architecture

### Token Types

| Token Type     | Storage Location            | Lifetime | Purpose                    |
|----------------|----------------------------|----------|----------------------------|
| Access Token   | In-memory + localStorage   | 24 hours | API Authorization          |
| Refresh Token  | HTTP-only cookie           | 7 days   | Token refresh (XSS-immune) |

### Storage Locations

```javascript
// localStorage keys
localStorage.token                        // Access token (JWT)
localStorage.userId                       // User ID
localStorage.tokenExpiration              // Timestamp (Date.now() + 24h)
localStorage['selectedProjectId:{userId}'] // User-scoped project selection
localStorage.REACT_QUERY_OFFLINE_CACHE    // Persisted query cache

// In-memory (apiClient.ts)
accessToken  // Primary access token (security best practice)
```

## Core Components

### 1. Authentication Layer
- **AuthContext** (`src/contexts/AuthContext.tsx`) - Central auth state management
- **authService** (`src/services/authService.ts`) - Auth API calls and token storage
- **apiClient** (`src/lib/apiClient.ts`) - Axios instance with auth interceptors

### 2. Caching Layer
- **QueryClient** (`src/lib/queryClient.ts`) - React Query configuration
- **cacheInvalidationService** (`src/services/cacheInvalidationService.ts`) - WebSocket-driven cache sync

### 3. Route Protection
- **ProtectedRoute** (`src/components/ProtectedRoute.tsx`) - Route guard component
- **useRoutePermission** (`src/hooks/useRoutePermission.js`) - Project selection validation

## Authentication Flows

### 1. Login Flow

**Entry Point:** `src/components/LoginRegister.tsx`  
**Service:** `src/services/authService.ts` (lines 154-180)

```
┌─────────────────┐
│   User Input    │
│ (username/pass) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ useLoginRegister│
│   New hook      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ authService.login(credentials)      │
│ POST /api/v1/auth/login             │
│ { username, password }              │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Backend returns: { Token, userId }  │
│ + Sets HTTP-only refresh cookie     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ storeAuthData(token, userId)        │
│ - setAccessToken(token)             │
│ - localStorage.setItem('userId')    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ AuthContext.login()                 │
│ - setIsAuthenticated(true)          │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Navigate to     │
│   /projects     │
└─────────────────┘
```

**Key Functions:**

| Function | Location | Purpose |
|----------|----------|---------|
| `login()` | `authService.ts:154` | API call to authenticate |
| `storeAuthData()` | `authService.ts:32` | Store tokens and userId |
| `setAccessToken()` | `apiClient.ts:71` | Update in-memory + localStorage token |

### 1.5. Google OAuth Login Flow

**Entry Point:** `src/components/LoginRegister.tsx` (Google OAuth button)  
**Callback Handler:** `src/components/GoogleOAuthCallback.tsx`  
**Service:** `src/services/authService.ts` (lines 187-225)

```
┌─────────────────────┐
│ User clicks         │
│ "Sign in with       │
│  Google" button     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ initiateGoogleOAuth(rememberMe)     │
│ GET /api/v1/auth/google/login       │
│ ?rememberMe={true|false}            │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Backend returns: { authUrl, state } │
│ authUrl = Google OAuth consent URL │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ window.location.href = authUrl      │
│ (Redirect to Google)                │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ User authorizes on Google           │
│ Google redirects to backend         │
│ /api/v1/auth/google/callback        │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Backend processes OAuth callback    │
│ - Validates state                   │
│ - Exchanges code for token          │
│ - Creates/updates user              │
│ - Generates access token            │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Backend redirects to frontend:     │
│ /auth/callback#token={base64-json} │
│ Token data: { token, userId,        │
│              isNewUser, user }      │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ GoogleOAuthCallback component     │
│ - Extracts token from hash          │
│ - Decodes base64 JSON               │
│ - Clears previous user cache        │
│   (if user changed)                │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ storeAuthData(token, userId)        │
│ - setAccessToken(token)             │
│ - localStorage.setItem('userId')    │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ window.dispatchEvent(               │
│   'auth-state-changed'              │
│ )                                    │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ AuthContext.handleAuthStateChange() │
│ - Detects tokens present            │
│ - Validates token expiration        │
│ - Refreshes if expired              │
│ - setIsAuthenticated(true)          │
│ - setUserId(userId)                 │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Wait 150ms for state propagation   │
│ queryClient.invalidateQueries(      │
│   { queryKey: ['projects'] }        │
│ )                                    │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ navigate('/projects')                │
│ Projects component mounts            │
│ - isAuthenticated = true            │
│ - Projects query enabled            │
│ - Projects fetch automatically      │
└─────────────────────────────────────┘
```

**Critical Implementation Details:**

1. **Token Storage from Hash:** Backend redirects with token in URL fragment (`#token=...`) to prevent token exposure in server logs
2. **Auth State Update:** `auth-state-changed` event triggers `AuthContext` to re-validate and update auth state
3. **Query Invalidation:** Projects query is invalidated to ensure fresh data fetch after OAuth login
4. **Cache Clearing:** Previous user's cache is cleared if switching users to prevent data leakage
5. **State Propagation Delay:** 150ms delay ensures `isAuthenticated` state updates before navigation

**Key Functions:**

| Function | Location | Purpose |
|----------|----------|---------|
| `initiateGoogleOAuth()` | `authService.ts:187` | Get Google OAuth authorization URL |
| `storeAuthData()` | `authService.ts:32` | Store tokens and userId |
| `handleAuthStateChange()` | `AuthContext.tsx:134` | Re-validate auth state on event |
| `GoogleOAuthCallback` | `GoogleOAuthCallback.tsx` | Handle OAuth redirect and token extraction |

**Related Documentation:**
- [Google OAuth Implementation Plan](../Tasks/google_oauth.md) - Complete OAuth implementation details
- [Fix Google OAuth Cache Leak](../Tasks/fix_google_oauth_cache_leak.md) - Cache clearing strategy

### 2. Token Refresh Flow

**Trigger Conditions:**
1. 401 Unauthorized response from API (automatic)
2. Token expiration check on app initialization
3. WebSocket connection attempts with expired tokens

**File:** `src/lib/apiClient.ts` (lines 206-293)

```
┌─────────────────────┐
│   API Request       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Interceptor adds    │
│ Bearer token        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐    ┌──────────────────────┐
│ Backend Response    │───►│ Success (2xx)        │
│                     │    │ Return response      │
└──────────┬──────────┘    └──────────────────────┘
           │
           ▼ (401 Unauthorized)
┌─────────────────────────────────────┐
│ Check: !originalRequest._retry      │
│        && hasUserId                 │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ isRefreshing = true                 │
│ Queue concurrent requests           │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ refreshToken()                      │
│ POST /api/v1/auth/refresh           │
│ (refresh_token cookie sent auto)    │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Backend returns: { token, userID }  │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ setAccessToken(newToken)            │
│ Process queued requests             │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Retry original request              │
│ with new token                      │
└──────────┬──────────────────────────┘
           │
           ├─────► Success: Return response
           │
           └─────► Failure: Clear auth + redirect to login
```

**Security Measures:**

1. **Route Detection:** Only refresh on non-auth routes (prevents loops)
2. **User Check:** Only refresh if `userId` exists (indicates logged-in user)
3. **Request Queue:** Queue concurrent requests during refresh (prevents race conditions)
4. **Retry Flag:** Mark requests with `_retry` flag (prevents infinite loops)

### 3. Logout Flow

**File:** `src/contexts/AuthContext.tsx` (lines 359-397)

```
┌─────────────────────┐
│ User clicks Logout  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 1. explicitLogoutRef.current = true             │
│    (prevents transient state issues)            │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 2. setIsAuthenticated(false)                    │
│    (disables queries)                           │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 3. queryClient.cancelQueries()                  │
│    (stops in-flight requests)                   │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 4. cacheInvalidationService.disconnect()        │
│    (closes WebSocket)                           │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 5. clearSelectedProject(userId)                 │
│    (clears project selection)                   │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 6. logoutService() → clearAccessToken()         │
│    (clears tokens from memory + localStorage)   │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 7. queryClient.clear()                          │
│    (wipes all cached data)                      │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 8. window.dispatchEvent('auth-state-changed')   │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│ Navigate to /       │
└─────────────────────┘
```

**Critical Logout Order:**

| Step | Action | Reason |
|------|--------|--------|
| 1 | Flag explicit logout | Prevents transient state confusion |
| 2 | Disable queries | Prevents new requests |
| 3 | Cancel in-flight requests | Clean pending work |
| 4 | Disconnect WebSocket | Prevent reconnection attempts |
| 5 | Clear project selection | Clean user data |
| 6 | Clear tokens | Remove auth credentials |
| 7 | Clear cache | Remove all stale data |
| 8 | Dispatch event | Notify other tabs/components |

### 4. Mobile Token Refresh (Background/Locked Screen)

**File:** `src/contexts/AuthContext.tsx` (lines 150-270)

**Problem:** On mobile devices, when the phone screen is locked or the app is in the background, JavaScript execution is throttled or paused. This prevents automatic token refresh from working, causing tokens to expire without being refreshed.

**Solution:** Multiple mechanisms ensure tokens are refreshed when the user returns:

1. **Page Visibility API** - Detects when page becomes visible again
2. **Focus Events** - Additional mobile browser support
3. **Periodic Checks** - Proactive token refresh every 5 minutes (only when visible)

```
┌─────────────────────────────────────────┐
│ Page becomes visible / Window focused    │
│ (visibilitychange or focus event)       │
└──────────────┬──────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ Check: hasToken && storedUserId?        │
└──────────────┬──────────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
      YES              NO
        │               │
        ▼               │
┌───────────────────┐   │
│ isTokenExpired()? │   │
└───────┬───────────┘   │
        │               │
   ┌────┴────┐          │
   ▼         ▼          │
 YES        NO          │
   │         │          │
   ▼         ▼          │
┌──────────────────┐ ┌──────────────────────┐
│ refreshToken()   │ │ Check expires < 5min? │
│ Update auth state│ │ If yes: refreshToken() │
└──────────────────┘ └──────────────────────┘
```

**Implementation Details:**

- **Visibility Change Handler:** Checks token expiration when `document.visibilityState === 'visible'`
- **Focus Event Handler:** Additional check on `window.focus` event (mobile browser support)
- **Periodic Check:** `setInterval` every 5 minutes (only runs when page is visible to save battery)
- **Proactive Refresh:** Refreshes tokens that expire within 5 minutes to prevent expiration during next background period

**Mobile-Specific Considerations:**

- Only checks when page is visible (saves battery)
- Checks token existence in localStorage (not `isAuthenticated` state, which might be stale)
- Handles expired tokens that occurred while in background
- Updates auth state after successful refresh

### 6. Auth State Change Event Handler

**File:** `src/contexts/AuthContext.tsx` (lines 134-186)

**Purpose:** Handles `auth-state-changed` events dispatched when auth state changes (login, logout, token refresh).

**Event Sources:**
1. **OAuth Login:** `GoogleOAuthCallback` dispatches after storing tokens
2. **Logout:** `AuthContext.logout()` dispatches after clearing tokens
3. **Token Expiration:** API client dispatches when refresh fails

**Handler Logic:**

```
┌─────────────────────────────────────┐
│ Event: 'auth-state-changed'         │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ handleAuthStateChange()             │
│ Check: hasToken && storedUserId?    │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
  YES            NO
   │              │
   │              ▼
   │      ┌─────────────────────┐
   │      │ Tokens cleared       │
   │      │ (Logout scenario)    │
   │      │ - setIsAuth(false)   │
   │      │ - setUserId(null)    │
   │      └─────────────────────┘
   │
   ▼
┌─────────────────────────────────────┐
│ Tokens present                      │
│ (OAuth login or token refresh)      │
│ - Check token expiration            │
│ - Refresh if expired                │
│ - setIsAuthenticated(true)          │
│ - setUserId(storedUserId)            │
└─────────────────────────────────────┘
```

**Key Behavior:**
- **Logout:** Clears auth state when tokens are missing
- **OAuth Login:** Re-validates and sets auth state when tokens are present
- **Token Refresh:** Handles token expiration during state changes

### 7. Session Initialization

**File:** `src/contexts/AuthContext.tsx` (lines 80-153)

```
┌─────────────────────┐
│ App Mount           │
│ AuthProvider mounts │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ useEffect() runs ONCE (empty deps)              │
│ checkAuthState()                                │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ storedUserId = getUserId()                      │
│ hasToken = !!localStorage.getItem('token')      │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ hasToken && storedUserId?    │
└──────────┬───────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
   YES            NO
    │              │
    ▼              ▼
┌─────────────┐   ┌─────────────────────┐
│isTokenExpired│   │setIsAuthenticated   │
│     ()?     │   │       (false)       │
└──────┬──────┘   └─────────────────────┘
       │
  ┌────┴────┐
  ▼         ▼
 YES        NO
  │          │
  ▼          ▼
┌───────────────────┐  ┌─────────────────────┐
│ refreshTokenService│  │setIsAuthenticated   │
│       ()          │  │       (true)        │
└─────────┬─────────┘  └─────────────────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
 Success      Failure (401)
    │            │
    ▼            ▼
┌──────────┐  ┌─────────────┐
│setIsAuth │  │Clear auth   │
│  (true)  │  │Logout       │
└──────────┘  └─────────────┘
```

**Key Checks:**

| Function | Purpose |
|----------|---------|
| `isTokenExpired()` | Checks stored `tokenExpiration` timestamp |
| `isJWTExpired()` | Decodes JWT and checks `exp` claim (WebSocket uses this) |

### 8. Session Persistence

**Storage Strategy:**

| Data | Storage | Reason |
|------|---------|--------|
| Access tokens | In-memory (primary) + localStorage (fallback) | Security + persistence |
| Refresh tokens | HTTP-only cookies | Never accessible to JS (XSS-immune) |
| User ID | localStorage | Session identification |
| Token expiration | localStorage (timestamp) | Quick expiry check |
| Selected project | localStorage (user-scoped key) | Cross-session persistence |

**Cross-Tab Synchronization:**

- **Storage Events:** Listens for `selectedProjectId` changes (AuthContext line 293-338)
- **Custom Events:** `project-changed` for same-tab updates
- **WebSocket:** Reconnection on project change

### 9. 403 Forbidden Handling

**Two-Level Handling:**

**1. API Interceptor** (`apiClient.ts:298-347`)
```javascript
IF 403 && url.match(/\/projects\/([^/]+)/):
  - Extract projectId
  - Remove from projects cache
  - Clear selectedProjectId if it matches
  - Invalidate project detail cache
```

**2. WebSocket Close Handler** (`cacheInvalidationService.ts:308-341`)
```javascript
IF code === 4003 || (code === 1008 && reason.includes('not authorized')):
  - Set authFailureDetected = true
  - Clear currentProjectId
  - Call onForbiddenCallback → AuthContext clears selectedProject
  - DON'T reconnect
```

## Security Considerations

### Token Security
- Access tokens stored in-memory (primary) to reduce XSS exposure
- Refresh tokens in HTTP-only cookies (never accessible to JavaScript)
- Automatic token refresh before expiration
- Token cleanup on logout and authentication failures

### Route Protection
- Protected routes require authentication via `ProtectedRoute` component
- Project-scoped routes require project selection validation
- Automatic redirects for unauthorized access
- Session persistence across page reloads

### Data Isolation
- Project selection scoped to user ID: `selectedProjectId:{userId}`
- localStorage keys prefixed with user ID to prevent cross-user data leakage
- WebSocket connections scoped to selected project
- Cache invalidation respects project boundaries

## Related Files

| File | Purpose |
|------|---------|
| `src/services/authService.ts` | Auth API calls, token storage, OAuth initiation |
| `src/lib/apiClient.ts` | Axios instance, interceptors |
| `src/contexts/AuthContext.tsx` | Auth state provider, event handlers |
| `src/components/ProtectedRoute.tsx` | Route guard |
| `src/components/LoginRegister.tsx` | Login/register UI, OAuth button |
| `src/components/GoogleOAuthCallback.tsx` | OAuth callback handler, token extraction |
| `src/hooks/useRoutePermission.js` | Project selection validation |

## Related Documentation

- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Caching Strategy](./caching_strategy.md) - React Query and cache invalidation
- [Realtime Messaging](./realtime_messaging.md) - WebSocket implementation
- [Risk Analysis](./risk_analysis.md) - Authentication risk areas and testing
- [File Reference](./file_reference.md) - Quick reference for auth-related files
- [Google OAuth Implementation](../Tasks/google_oauth.md) - Google OAuth 2.0 implementation plan
- [Fix Google OAuth Cache Leak](../Tasks/fix_google_oauth_cache_leak.md) - OAuth cache clearing strategy


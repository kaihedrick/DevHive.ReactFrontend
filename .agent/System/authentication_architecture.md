# Authentication Architecture - DevHive React Frontend

## Overview

The authentication system uses a dual-token approach with automatic token refresh and session persistence. This document describes the complete authentication flow, token management, and security measures.

**CRITICAL UPDATES (2025-12-23):** 
- Fixed order of operations issues that caused unexpected logouts on network errors
- Implemented JWT expiration parsing to use actual backend token expiration
- Added iOS Safari cookie handling fixes for mobile devices
- Improved logout flow to prevent remounting and preserve console logs
- Enhanced token refresh with retry logic and coordination mechanisms
- **Always attempt refresh on initialization/visibility change** - Refresh endpoint only checks refresh token cookie (not access token), so we always attempt refresh when credentials exist

## Architecture Summary

- **Dual-token system**: Access tokens (JWT, 15min) + HTTP-only refresh tokens (7d session or 30d persistent)
- **In-memory + localStorage token management** with automatic refresh
- **React Query for data caching** with WebSocket-driven invalidation
- **Real-time cache synchronization** via WebSocket connections
- **User-scoped project selection** to prevent cross-account data leakage
- **Resilient authentication**: Only 401 errors trigger logout; network/server errors preserve auth state
- **JWT expiration parsing**: Uses actual backend token expiration instead of frontend-calculated timestamps
- **iOS Safari support**: Retry logic and cookie handling fixes for mobile Safari
- **Proactive refresh**: 10-minute window with 30-second buffer to prevent expiration
- **Always-attempt refresh**: Refresh endpoint only validates refresh token cookie (not access token), so we always attempt refresh when credentials exist, allowing users to stay logged in even after long periods of inactivity

## Critical Fixes (2025-12-23)

### Problem: Unexpected Logouts on Network Errors

**Issue:** Token refresh failures from network errors, timeouts, or server errors (500) were clearing authentication tokens and logging users out, even though the refresh token cookie was still valid.

**Root Cause:** Two locations in `apiClient.ts` unconditionally cleared tokens on ANY refresh failure:
1. `refreshToken()` function (line 128) - cleared tokens on all errors
2. Response interceptor (line 280) - cleared tokens and dispatched logout event on all errors

**Impact:** Users with slow/unreliable networks were repeatedly logged out during temporary network issues.

### Solution: 401-Only Logout Logic

**Fixed Locations:**
- `src/lib/apiClient.ts:128-139` - `refreshToken()` function now checks error status
- `src/lib/apiClient.ts:280-340` - Response interceptor now checks error status

**New Behavior:**
```javascript
// Only clear tokens on 401 (refresh token expired)
const is401 = refreshError?.response?.status === 401;
if (is401) {
    clearAccessToken();
    window.dispatchEvent(new Event('auth-state-changed'));
} else {
    // Keep tokens - refresh token cookie still valid
    console.warn('Refresh failed with non-401 error, keeping tokens for retry');
}
```

**Result:**
- ✅ 401 errors (refresh token expired) → User logged out
- ✅ Network errors, timeouts, 500 errors → User stays logged in, can retry
- ✅ Users with slow networks no longer experience unexpected logouts

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
| Access Token   | In-memory + localStorage   | 15 minutes | API Authorization          |
| Refresh Token  | HTTP-only cookie           | 7 days (session) or 30 days (persistent) | Token refresh (XSS-immune) |

**Refresh Token Details:**
- **Session (rememberMe = false):**
  - Database expiry: 7 days (default, configurable via `JWT_REFRESH_EXPIRATION_DAYS`)
  - Cookie: Session cookie (expires when browser closes)
  - Use case: Temporary sessions, logout on browser close
  
- **Persistent (rememberMe = true):**
  - Database expiry: 30 days (configurable via `JWT_REFRESH_EXPIRATION_PERSISTENT_DAYS`)
  - Cookie: MaxAge = 30 days
  - Use case: "Remember Me" functionality, stays logged in across browser sessions

**Backend Configuration (configurable via environment variables):**
- `JWT_EXPIRATION_MINUTES`: Access token lifetime (default: 15 minutes)
- `JWT_REFRESH_EXPIRATION_DAYS`: Session refresh token expiry (default: 7 days)
- `JWT_REFRESH_EXPIRATION_PERSISTENT_DAYS`: Persistent refresh token expiry (default: 30 days)

### Storage Locations

```javascript
// localStorage keys
localStorage.token                        // Access token (JWT)
localStorage.userId                       // User ID
localStorage.tokenExpiration              // Timestamp (from JWT exp claim, typically ~15 minutes)
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
4. Proactive refresh when token expires within 10 minutes
5. Page visibility change (mobile background/locked screen)

**File:** `src/lib/apiClient.ts` (lines 257-340)

**CRITICAL IMPROVEMENTS (2025-12-23):**
- **JWT Expiration Parsing:** Uses actual `exp` claim from JWT instead of frontend-calculated timestamp
- **30-Second Buffer:** Prevents race conditions where token expires between check and request
- **iOS Safari Retry Logic:** Retries 401 errors once (first attempt only) for cookie attachment issues; retries network errors up to 3 times with exponential backoff
- **Refresh Coordination:** Prevents concurrent refresh attempts during initialization

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
5. **401-Only Logout:** Only clear tokens on 401 errors, not network/server errors
6. **Refresh Coordination:** Wait for initialization refresh to complete before retrying 401s

**Token Expiration Handling:**

1. **JWT Expiration Parsing:** `parseJWTExpiration()` extracts actual `exp` claim from token
2. **30-Second Buffer:** `isTokenExpired()` adds buffer to prevent race conditions
3. **Proactive Refresh:** Tokens refreshed 10 minutes before expiration
4. **Debug Logging:** Logs token TTL and expiration times for troubleshooting

**iOS Safari Cookie Handling:**

1. **401 Error Retry:** Retries once (on first attempt only) with 150ms delay for iOS Safari cookie attachment issues. If 401 occurs again, the refresh token is expired and auth is cleared.
2. **Network Error Retry:** Retries up to 3 times with exponential backoff (150ms, 300ms, 600ms) for transient network errors
3. **Cookie Attachment:** Gives Safari time to properly attach HttpOnly cookies after page reload
4. **Coordination:** Response interceptor waits for initialization refresh to complete
5. **Efficient Failure Handling:** Prevents unnecessary retries when refresh token is legitimately expired, reducing user wait time

### 3. Logout Flow

**File:** `src/contexts/AuthContext.tsx` (lines 701-781)

**CRITICAL:** All logout operations MUST go through `AuthContext.logout()` function. Never call `logoutService()` directly - this bypasses proper cleanup order and causes remounting.

**Logout Triggers:**
1. User clicks logout button → `logout()` function called directly
2. Token refresh fails with 401 → `apiClient.ts` clears tokens, dispatches event → `handleAuthStateChange()` calls `logout()`
3. Refresh token invalid during initialization → `checkAuthState()` calls `logout()`

```
┌─────────────────────┐
│ Logout Triggered    │
│ (user click OR      │
│  token refresh fail)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 1. explicitLogoutRef.current = true             │
│    (prevents transient state issues)            │
│    CRITICAL: Set FIRST before any state changes │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 2. setIsAuthenticated(false)                    │
│    (disables queries immediately)                │
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
│    (closes WebSocket, prevents reconnection)    │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 5. clearSelectedProject(userId)                 │
│    (clears user-scoped project selection)       │
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
│ 8. localStorage.removeItem(                     │
│    'REACT_QUERY_OFFLINE_CACHE')                 │
│    (clears persisted cache)                      │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 9. window.dispatchEvent('auth-state-changed')   │
│    (notifies other tabs/components)             │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 10. ProtectedRoute detects isAuthenticated=false│
│     and redirects to / (no remounting!)         │
└─────────────────────────────────────────────────┘
```

**Critical Logout Order:**

| Step | Action | Reason |
|------|--------|--------|
| 1 | Flag explicit logout FIRST | Prevents race conditions with WebSocket effect |
| 2 | Disable queries | Prevents new requests |
| 3 | Cancel in-flight requests | Clean pending work |
| 4 | Disconnect WebSocket | Prevent reconnection attempts |
| 5 | Clear project selection | Clean user data |
| 6 | Clear tokens | Remove auth credentials |
| 7 | Clear cache | Remove all stale data |
| 8 | Clear persisted cache | Remove offline cache |
| 9 | Dispatch event | Notify other tabs/components |
| 10 | ProtectedRoute redirects | No remounting - preserves console logs |

**Preventing Unexpected Logouts:**

1. **Only logout on 401 errors** - Network errors or other non-401 errors should NOT trigger logout
2. **Use proper logout flow** - Always call `AuthContext.logout()`, never `logoutService()` directly
3. **No redirects in apiClient** - Let ProtectedRoute handle navigation to prevent remounting
4. **Set explicitLogoutRef FIRST** - Prevents race conditions where WebSocket effect checks before flag is set
5. **Preserve console logs** - No remounting allows debugging logout issues

**Token Refresh Failure Flow:**

**CRITICAL: Only 401 errors trigger logout. All other errors preserve auth state.**

When token refresh fails in `apiClient.ts` (lines 257-340):

**Case 1: 401 Error (Refresh Token Expired)**
```
1. Refresh API call fails with 401
2. Check: is401 = refreshError?.response?.status === 401 ✅
3. clearAccessToken() - removes tokens from memory + localStorage
4. Dispatch 'auth-state-changed' event
5. AuthContext.handleAuthStateChange() detects tokens cleared
6. Sets explicitLogoutRef.current = true FIRST (before state changes)
7. Sets isAuthenticated = false
8. WebSocket effect detects explicitLogoutRef and disconnects
9. ProtectedRoute redirects to '/' (no remounting)
```

**Case 2: Non-401 Error (Network, Timeout, 500, etc.)**
```
1. Refresh API call fails with network error/timeout/500
2. Check: is401 = false ❌
3. Keep tokens in localStorage (refresh token cookie still valid!)
4. Log warning: "Refresh failed with non-401 error, keeping tokens for retry"
5. Return error to caller
6. Auth state preserved - user stays logged in
7. User retries request when network/server recovers
8. Refresh succeeds on retry ✅
```

**Why This Matters:**

- **Old behavior:** ANY refresh failure (network, timeout, 500) logged user out
- **New behavior:** Only refresh token expiration (401) logs user out
- **Impact:** Users with slow/unreliable networks stay logged in instead of being repeatedly logged out

**Related Code:**
- `apiClient.ts:128-139` - refreshToken() function checks 401 before clearing
- `apiClient.ts:280-340` - Response interceptor checks 401 before clearing and dispatching event

### 4. Mobile Token Refresh (Background/Locked Screen)

**File:** `src/contexts/AuthContext.tsx` (lines 294-469)

**Problem:** On mobile devices, when the phone screen is locked or the app is in the background, JavaScript execution is throttled or paused. This prevents automatic token refresh from working, causing tokens to expire without being refreshed.

**Solution:** Multiple mechanisms ensure tokens are refreshed when the user returns:

1. **Page Visibility API** - Detects when page becomes visible again
2. **Focus Events** - Additional mobile browser support
3. **Periodic Checks** - Proactive token refresh every 5 minutes (only when visible)

**CRITICAL:** Always attempts refresh when page becomes visible if credentials exist, regardless of access token expiration. Since the refresh endpoint only checks the refresh token cookie (not the access token), we should always attempt refresh to ensure users stay logged in even after the app has been closed/backgrounded for days.

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
┌─────────────────────┐ │
│ ALWAYS attempt      │ │
│ refreshToken()      │ │
│ (backend checks     │ │
│  refresh token      │ │
│  cookie only)       │ │
└──────────┬──────────┘ │
           │            │
    ┌──────┴──────┐     │
    ▼             ▼     │
 Success      Failure (401)
    │            │      │
    ▼            ▼      │
┌──────────┐  ┌──────────┐
│Update    │  │Clear auth│
│auth state│  │Logout    │
└──────────┘  └──────────┘
```

**Implementation Details:**

- **Visibility Change Handler:** Always attempts refresh when `document.visibilityState === 'visible'` if credentials exist
- **Focus Event Handler:** Additional check on `window.focus` event (mobile browser support)
- **Periodic Check:** `setInterval` every 5 minutes (only runs when page is visible to save battery)
  - Refreshes if token is expired
  - Proactively refreshes if token expires within 10 minutes
- **iOS Safari Cookie Handling:** Adds 100ms delay before refresh to allow Safari to attach HttpOnly cookies

**Mobile-Specific Considerations:**

- Only checks when page is visible (saves battery)
- Checks token existence in localStorage (not `isAuthenticated` state, which might be stale)
- Always attempts refresh on visibility change to handle expired tokens from background periods
- Updates auth state after successful refresh
- Refresh token cookie validity (7 days session or 30 days persistent) allows users to stay logged in even after long background periods

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

**File:** `src/contexts/AuthContext.tsx` (lines 80-163)

**CRITICAL:** Always attempts refresh on initialization if credentials exist, regardless of access token expiration. Since the refresh endpoint only checks the refresh token cookie (not the access token), we should always attempt refresh and let the backend tell us if the refresh token is invalid via 401.

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
┌─────────────────────┐  ┌─────────────────────┐
│ ALWAYS attempt      │  │setIsAuthenticated   │
│ refreshTokenService │  │       (false)       │
│ (backend checks     │  │                     │
│  refresh token      │  │                     │
│  cookie only)       │  │                     │
└──────────┬──────────┘  └─────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
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

## UI Improvements (2025-12-23)

### Apple Minimalist Design

The login interface has been updated with Apple-inspired minimalist design:

**Remember Me Checkbox:**
- Custom-styled checkbox with subtle borders
- Smooth transitions and hover effects
- Gold accent when checked with white checkmark
- Simplified text: "Remember me" (removed verbose description)
- Positioned on same line as "Forgot Password?" for better layout

**Google Sign In Button:**
- Clean, minimal styling with subtle borders and shadows
- Text changed to "Continue with Google" (more Apple-like)
- Smaller icon (18px) for better proportion
- Softer hover effects (subtle lift, no color change)
- Properly scoped styles to prevent global CSS conflicts
- Dark text on white background for visibility

**Design Principles:**
- Subtle borders and shadows
- Smooth transitions
- Clean typography with slight letter-spacing
- Minimal color palette aligned with DevHive gold/black theme
- Refined hover and active states

## Related Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/services/authService.ts` | Auth API calls, token storage, OAuth initiation | `login()`, `refreshToken()`, `initiateGoogleOAuth()` |
| `src/lib/apiClient.ts` | Axios instance, interceptors, token management | `setAccessToken()`, `refreshToken()`, `parseJWTExpiration()`, `isTokenExpired()`, `setIsRefreshing()`, `setAuthInitializationPromise()` |
| `src/contexts/AuthContext.tsx` | Auth state provider, event handlers | `logout()`, `checkAuthState()`, `handleAuthStateChange()` |
| `src/components/ProtectedRoute.tsx` | Route guard | Redirects unauthenticated users |
| `src/components/LoginRegister.tsx` | Login/register UI, OAuth button | Apple minimalist design, Remember Me checkbox |
| `src/components/GoogleOAuthCallback.tsx` | OAuth callback handler, token extraction | Handles OAuth redirect |
| `src/hooks/useRoutePermission.js` | Project selection validation | Validates project access |
| `src/styles/login_register.css` | Login page styling | Apple minimalist styles, scoped button styles |

## Related Documentation

- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Caching Strategy](./caching_strategy.md) - React Query and cache invalidation
- [Realtime Messaging](./realtime_messaging.md) - WebSocket implementation
- [Risk Analysis](./risk_analysis.md) - Authentication risk areas and testing
- [File Reference](./file_reference.md) - Quick reference for auth-related files
- [Google OAuth Implementation](../Tasks/google_oauth.md) - Google OAuth 2.0 implementation plan
- [Fix Google OAuth Cache Leak](../Tasks/fix_google_oauth_cache_leak.md) - OAuth cache clearing strategy
- [Fix Authentication 15-Minute Logouts](../Tasks/fix_authentication_15min_logout.md) - Token refresh fixes and iOS Safari handling


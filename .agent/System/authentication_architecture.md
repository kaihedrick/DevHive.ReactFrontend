# Authentication Architecture - DevHive React Frontend

## Overview

The authentication system uses a dual-token approach with automatic token refresh and session persistence. This document describes the complete authentication flow, token management, and security measures.

**CRITICAL UPDATES (2025-12-26):**
- **Refresh Token Expiration Event Handling** - Fixed race condition where refresh token expiry left users in invalid authenticated state. Added `auth-state-changed` event mechanism to sync AuthContext state when localStorage.userId is cleared but React state remains set.

**CRITICAL UPDATES (2025-12-23):**
- Fixed order of operations issues that caused unexpected logouts on network errors
- Implemented JWT expiration parsing to use actual backend token expiration
- Added iOS Safari cookie handling fixes for mobile devices
- Improved logout flow to prevent remounting and preserve console logs
- Enhanced token refresh with retry logic and coordination mechanisms
- **Unconditional refresh on initialization** - Always attempt refresh on app mount, regardless of localStorage state. We cannot check refresh token cookie existence from JavaScript (it's HttpOnly), so we always attempt refresh and let backend return 401 if cookie is invalid. This ensures sessions persist even if localStorage was cleared but refresh token cookie remains valid.

**LATEST UPDATES (2025-12-23):**
- **OAuth double refresh fix** - Prevents refresh token call during OAuth callback to avoid 401 errors and token clearing immediately after OAuth login
- **Auth initialization flag** - Added `authInitialized` flag to prevent premature redirects during app bootstrap, fixing race condition where logged-out users could access protected routes after page refresh
- **Comprehensive logout cleanup** - Logout now calls backend logout endpoint to clear refresh token cookie, clears all localStorage keys (projects, cache, userId), and ensures users cannot access protected routes after logout and page refresh
- **CRITICAL: Never refresh if access token exists** - Refresh is recovery, not validation. If access token exists (fresh login), never call refresh endpoint. This prevents immediate 401-after-login where refresh cookie may not be ready yet, causing auth to be incorrectly cleared.
- **Mobile Safari bootstrap refresh fix** - Prevents routes from triggering refresh during bootstrap. Response interceptor now checks `authInitialized` flag before triggering refresh, ensuring bootstrap refresh completes before any route-level refresh attempts. This fixes issue where account/profile routes would trigger refresh during bootstrap, causing logout on mobile Safari.
- **iOS Safari persistent cookie fix** - Forces `rememberMe=true` on iOS Safari for both regular login and Google OAuth. iOS Safari deletes session cookies when the app is closed, so persistent cookies (Max-Age) are required. The Remember Me checkbox is automatically checked and disabled on iOS Safari with a helpful message.

## Architecture Summary

- **Dual-token system**: Access tokens (JWT, 15min) + HTTP-only refresh tokens (7d session or 30d persistent)
- **In-memory + localStorage token management** with automatic refresh
- **React Query for data caching** with WebSocket-driven invalidation
- **Real-time cache synchronization** via WebSocket connections
- **User-scoped project selection** to prevent cross-account data leakage
- **Resilient authentication**: Only 401 errors trigger logout; network/server errors preserve auth state
- **JWT expiration parsing**: Uses actual backend token expiration instead of frontend-calculated timestamps
- **iOS Safari support**: Retry logic and cookie handling fixes for mobile Safari
- **Proactive refresh**: 10-minute window to prevent expiration
- **Unconditional refresh on initialization**: Always attempt refresh on app mount, regardless of localStorage state (userId/token). We cannot check refresh token cookie existence from JavaScript (it's HttpOnly), so we always attempt refresh and let backend return 401 if cookie is invalid. This ensures sessions persist even if localStorage was cleared but refresh token cookie remains valid (7 days session or 30 days persistent)

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

## Critical Fixes (2025-12-26)

### Problem: Refresh Token Expiration Race Condition

**Issue:** When the refresh token expires, the 401 interceptor clears `localStorage.userId` but `AuthContext`'s `userId` state remains set, leaving users in an invalid authenticated state. All subsequent API calls fail with 401, but the app thinks the user is still logged in.

**Root Cause:** Storage events only fire for cross-tab changes, not same-tab changes. When `apiClient.ts` clears `localStorage.userId` in the same tab, `AuthContext` doesn't detect this change.

**Impact:** Users appear authenticated but cannot perform any actions, with all API calls failing with 401 errors. The app gets stuck in an unusable state until manual refresh or logout.

### Solution: Auth State Change Event Mechanism

**Implementation:** Added `auth-state-changed` event dispatch when refresh token expires, with `AuthContext` listening for this event to sync state.

**Fixed Locations:**
- `src/lib/apiClient.ts:180` - `refreshToken()` dispatches event when clearing auth on 401
- `src/lib/apiClient.ts:342` - 401 interceptor dispatches event when refresh fails with 401
- `src/contexts/AuthContext.tsx:203-234` - Added event listener to sync auth state

**Event Flow:**
```javascript
// In apiClient.ts when refresh token expires:
if (is401 && !hasAccessToken && !isOAuthFlow) {
  clearAccessToken();
  localStorage.removeItem('userId');
  window.dispatchEvent(new Event('auth-state-changed')); // ← NEW
}

// In AuthContext.tsx:
useEffect(() => {
  const handleAuthStateChange = () => {
    const storedUserId = getUserId();
    if (!storedUserId && userId) {
      // Sync state: clear userId, authState, etc.
      setUserId(null);
      setAuthState('unauthenticated');
      // ... cleanup WebSocket, selected project, etc.
    }
  };
  window.addEventListener('auth-state-changed', handleAuthStateChange);
  // ...
}, [userId]);
```

**Result:**
- ✅ Refresh token expiration properly logs users out
- ✅ `AuthContext` state stays synchronized with localStorage
- ✅ No more stuck authenticated state with failing API calls
- ✅ Proper cleanup: WebSocket disconnect, project clearing, cache clearing

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
│  - WebSocket (WSS) for real-time cache invalidation at `wss://ws.devhive.it.com` (production) │
│    or `ws://localhost:8080/api/v1/messages/ws` (development) │
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
localStorage.userId                       // User ID
localStorage['selectedProjectId:{userId}'] // User-scoped project selection (user-scoped)
localStorage.REACT_QUERY_OFFLINE_CACHE    // Persisted query cache

// In-memory (apiClient.ts)
accessToken  // Primary access token (security best practice - NOT in localStorage)
```

**CRITICAL (2025-12-23):** Access tokens are stored ONLY in memory, not in localStorage. This is a security best practice to prevent XSS attacks from stealing tokens. Token expiration is calculated from JWT `exp` claim, not stored separately.

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

## App Initialization & Auth Bootstrap

**File:** `src/contexts/AuthContext.tsx` (lines 88-122)

**CRITICAL FIX (2025-12-23):** Added `authInitialized` flag to prevent premature redirects during app bootstrap. This fixes race condition where logged-out users could access protected routes after page refresh.

**Initialization Flow:**

```
┌─────────────────────┐
│ App Mounts          │
│ authInitialized =   │
│   false (default)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Check: getAccessToken() exists?     │
│ (in-memory token check)             │
└──────────┬──────────────────────────┘
           │
           ├─── YES ──────────────────────┐
           │                               │
           │    ┌──────────────────────────▼──────────────────────────┐
           │    │ Token exists (e.g., from OAuth)                    │
           │    │ - getUserId() from localStorage                    │
           │    │ - setUserId(userId)                                │
           │    │ - setAuthState('authenticated')                    │
           │    │ - setAuthInitialized(true)                         │
           │    │ - SKIP refresh (token already fresh)               │
           │    └────────────────────────────────────────────────────┘
           │
           └─── NO ────────────────────────┐
                                           │
              ┌────────────────────────────▼──────────────────────────┐
              │ No token - attempt refresh to restore session        │
              │ POST /api/v1/auth/refresh                            │
              │ (refresh_token cookie sent automatically)            │
              └──────────┬───────────────────────────────────────────┘
                         │
                         ├─── SUCCESS ────────────────────┐
                         │                                 │
                         │    ┌────────────────────────────▼──────────┐
                         │    │ Refresh succeeded                     │
                         │    │ - Token set in memory                │
                         │    │ - userId from localStorage           │
                         │    │ - setUserId(userId)                  │
                         │    │ - setAuthState('authenticated')      │
                         │    │ - setAuthInitialized(true)           │
                         │    └───────────────────────────────────────┘
                         │
                         └─── FAILURE (401) ──────────────┐
                                                           │
                            ┌──────────────────────────────▼──────────┐
                            │ Refresh failed (401)                    │
                            │ Check: getAccessToken() exists?         │
                            └──────────┬───────────────────────────────┘
                                       │
                                       ├─── YES ────────────────────┐
                                       │                             │
                                       │    ┌────────────────────────▼──────┐
                                       │    │ Ignore 401 - access token    │
                                       │    │ exists (fresh login, cookie   │
                                       │    │ not ready yet)                │
                                       │    │ - setUserId(userId)           │
                                       │    │ - setAuthState('authenticated')│
                                       │    └───────────────────────────────┘
                                       │
                                       └─── NO ─────────────────────┐
                                                                    │
                                       ┌────────────────────────────▼──────┐
                                       │ No access token - clear auth      │
                                       │ - setUserId(null)                  │
                                       │ - setAuthState('unauthenticated')  │
                                       └────────────────────────────────────┘
                            │
                            ▼
                            setAuthInitialized(true)
                            ProtectedRoute redirects if needed
```

**Key Points:**

1. **`authInitialized` Flag:** Prevents redirects until auth state is determined. All route guards (`ProtectedRoute`, `LoginRouteWrapper`) check this flag before making navigation decisions.
2. **Skip Refresh if Token Exists:** If token already exists (e.g., from OAuth or fresh login), skip refresh to avoid unnecessary API calls and potential 401 errors.
3. **Conditional Refresh:** If no token exists, attempt refresh to restore session (we cannot check refresh token cookie existence from JavaScript since it's HttpOnly).
4. **Never Clear Auth on Refresh 401 if Token Exists:** If refresh returns 401 but access token exists, preserve auth state (user just logged in, cookie may not be ready yet).
5. **Always Set Flag:** `authInitialized` is always set to `true` in the `finally` block, ensuring routes are never blocked permanently.
6. **apiClient Synchronization:** When `authInitialized` is set to `true`, `apiClient.setAuthInitialized(true)` is also called. This ensures the response interceptor knows when bootstrap refresh is complete and can safely trigger refresh on 401 errors. This prevents routes from triggering refresh during bootstrap, fixing mobile Safari issue where account/profile routes would cause logout.

**CRITICAL RULE: Refresh is Recovery, Not Validation**

- **Refresh when:** No access token exists (cold start, page reload, expired session)
- **Never refresh when:** Access token exists (fresh login, OAuth callback, active session)
- **Why:** Refresh cookie may not be ready immediately after login. If access token exists, trust it and skip refresh.

**Route Guard Protection:**

- **ProtectedRoute:** Shows loading fallback until `authInitialized === true`, then checks `userId` for authentication
- **LoginRouteWrapper:** Shows loading fallback until `authInitialized === true`, then redirects to `/projects` only if authenticated

## Authentication Flows

### 1. Login Flow

**Entry Point:** `src/components/LoginRegister.tsx`  
**Service:** `src/services/authService.ts` (lines 154-186)

**CRITICAL: iOS Safari Persistent Cookie Fix (2025-12-23):**
- iOS Safari automatically deletes session cookies when the app is closed
- To prevent logouts on app close, `rememberMe` is forced to `true` on iOS Safari
- The Remember Me checkbox is automatically checked and disabled on iOS Safari
- This ensures persistent refresh cookies (Max-Age) are issued instead of session cookies

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

**CRITICAL FIX (2025-12-23):** OAuth callback no longer calls refresh token endpoint. OAuth already provides a fresh, trusted token, so no refresh is needed. This prevents double refresh (OAuth callback + initialization) that was causing 401 errors and token clearing immediately after login.

**iOS Safari Persistent Cookie Fix (2025-12-23):**
- `rememberMe` is forced to `true` on iOS Safari for Google OAuth
- This ensures persistent refresh cookies are issued, preventing logouts on app close

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
│ - Sets refresh token cookie         │
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
│ 1. setOAuthMode(true)              │
│    (prevents refresh during OAuth) │
│ 2. Extract token from hash          │
│ 3. Decode base64 JSON               │
│ 4. Clear previous user cache        │
│    (if user changed)                │
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
│ completeOAuthLogin(userId)          │
│ - setUserId(userId)                 │
│ - setAuthState('authenticated')     │
│ - NO refresh token call             │
│   (OAuth already provides fresh token)│
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ setOAuthMode(false)                 │
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
2. **OAuth Mode Guard:** `setOAuthMode(true)` prevents refresh token calls during OAuth flow, avoiding double refresh that causes 401 errors
3. **Direct State Update:** `completeOAuthLogin()` directly sets auth state without calling refresh endpoint (OAuth already provides fresh token)
4. **Query Invalidation:** Projects query is invalidated to ensure fresh data fetch after OAuth login
5. **Cache Clearing:** Previous user's cache is cleared if switching users to prevent data leakage
6. **No Refresh Needed:** OAuth callback does NOT call refresh token endpoint - OAuth token is already fresh and trusted

**Key Functions:**

| Function | Location | Purpose |
|----------|----------|---------|
| `initiateGoogleOAuth()` | `authService.ts:187` | Get Google OAuth authorization URL |
| `storeAuthData()` | `authService.ts:32` | Store tokens and userId |
| `completeOAuthLogin()` | `AuthContext.tsx:381` | Directly sets auth state after OAuth login (no refresh needed) |
| `GoogleOAuthCallback` | `GoogleOAuthCallback.tsx` | Handle OAuth redirect and token extraction |

**Related Documentation:**
- [Google OAuth Implementation Plan](../Tasks/google_oauth.md) - Complete OAuth implementation details
- [Fix Google OAuth Cache Leak](../Tasks/fix_google_oauth_cache_leak.md) - Cache clearing strategy

### 2. Token Refresh Flow

**Trigger Conditions:**
1. **Proactive Refresh:** Every 5 minutes if token expires within 10 minutes (NEW - 2025-12-26)
2. 401 Unauthorized response from API with expired token (FIXED - 2025-12-26)
3. Token expiration check on app initialization
4. WebSocket connection attempts with expired tokens
5. Page visibility change (mobile background/locked screen)

**File:** `src/lib/apiClient.ts` (lines 257-340) + `src/contexts/AuthContext.tsx` (lines 157-175)

**CRITICAL IMPROVEMENTS (2025-12-23 to 2025-12-26):**
- **Proactive Token Refresh (2025-12-26):** Automatic refresh every 5 minutes when token expires within 10 minutes, preventing 15-minute logouts
- **Fixed 401 Interceptor Logic (2025-12-26):** Now refreshes on expired tokens, not just missing tokens
- **JWT Expiration Parsing:** Uses actual `exp` claim from JWT instead of frontend-calculated timestamp
- **30-Second Buffer:** Prevents race conditions where token expires between check and request
- **iOS Safari Retry Logic:** Retries 401 errors once (first attempt only) for cookie attachment issues; retries network errors up to 3 times with exponential backoff
- **Refresh Coordination:** Prevents concurrent refresh attempts during initialization
- **Bootstrap refresh protection** - Response interceptor now checks `authInitialized` flag before triggering refresh. If auth is not initialized (bootstrap refresh in progress), 401 errors are rejected without triggering refresh. This prevents routes from triggering refresh during bootstrap, fixing mobile Safari issue where account/profile routes would cause logout.
- **CRITICAL FIX (2025-12-26):** `refreshToken()` function now properly checks token expiration. Previously, it would return expired tokens without refreshing, causing WebSocket authentication failures and preventing real-time updates.

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
│        && (!hasAccessToken          │
│            || tokenIsExpired)       │
│        && authInitialized           │
│        (FIXED: Now refreshes expired │
│         tokens, not just missing ones)│
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
│ Check: getAccessToken() exists?     │
└──────────┬──────────────────────────┘
           │
           ├─── YES ──────────────────┐
           │                           │
           │    ┌──────────────────────▼──────────────┐
           │    │ Return existing token immediately   │
           │    │ (No API call - refresh is recovery) │
           │    └─────────────────────────────────────┘
           │
           └─── NO ────────────────────┐
                                       │
              ┌────────────────────────▼────────────────────────┐
              │ POST /api/v1/auth/refresh                       │
              │ (refresh_token cookie sent auto)                │
              └──────────┬───────────────────────────────────────┘
                         │
                         ├─── SUCCESS ──────────────────┐
                         │                              │
                         │    ┌─────────────────────────▼──────────┐
                         │    │ Backend returns: { token, userID }│
                         │    │ setAccessToken(newToken)          │
                         │    │ Process queued requests            │
                         │    └────────────────────────────────────┘
                         │
                         └─── FAILURE (401) ────────────┐
                                                         │
                            ┌────────────────────────────▼──────────┐
                            │ Check: getAccessToken() exists?      │
                            └──────────┬───────────────────────────┘
                                       │
                                       ├─── YES ────────────────────┐
                                       │                             │
                                       │    ┌───────────────────────▼──────┐
                                       │    │ Ignore 401 - access token   │
                                       │    │ exists (fresh login, cookie   │
                                       │    │ not ready yet)               │
                                       │    └───────────────────────────────┘
                                       │
                                       └─── NO ─────────────────────┐
                                                                    │
                                       ┌────────────────────────────▼──────┐
                                       │ Clear auth - refresh token expired │
                                       │ (No access token to fall back to) │
                                       └────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Retry original request              │
│ with token (existing or new)        │
└──────────┬──────────────────────────┘
           │
           ├─────► Success: Return response
           │
           └─────► Failure: Clear auth + redirect to login
```

**Security Measures:**

1. **Route Detection:** Only refresh on non-auth routes (prevents loops)
2. **Access Token Check:** **CRITICAL** - Never refresh if access token exists (refresh is recovery, not validation)
3. **Auth Initialization Check:** **CRITICAL** - Never trigger refresh during bootstrap (before `authInitialized` is true). This prevents routes from triggering refresh during bootstrap, which causes logout on mobile Safari.
4. **Request Queue:** Queue concurrent requests during refresh (prevents race conditions)
5. **Retry Flag:** Mark requests with `_retry` flag (prevents infinite loops)
6. **401-Only Logout:** Only clear tokens on 401 errors, not network/server errors
7. **Refresh Coordination:** Wait for initialization refresh to complete before retrying 401s
8. **Never clear auth on refresh 401 if access token exists:** If refresh returns 401 but access token exists, ignore the 401 (user just logged in, cookie may not be ready yet)

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

**File:** `src/contexts/AuthContext.tsx` (lines 353-404)

**CRITICAL UPDATES (2025-12-23):**
- Logout now calls backend logout endpoint to clear refresh token cookie (HTTP-only cookie)
- Comprehensive cleanup of all localStorage keys (projects, cache, userId)
- Ensures users cannot access protected routes after logout and page refresh

**Logout Triggers:**
1. User clicks logout button → `logout()` function called directly
2. Token refresh fails with 401 → Auth state set to `unauthenticated`

**CRITICAL:** All logout operations MUST go through `AuthContext.logout()` function. Never call `logoutService()` directly - this bypasses proper cleanup order.

```
┌─────────────────────┐
│ Logout Triggered    │
│ (user click)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 1. POST /api/v1/auth/logout                     │
│    (clears refresh token HTTP-only cookie)      │
│    CRITICAL: Must be called FIRST               │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 2. clearAccessToken()                           │
│    (clears in-memory access token)              │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 3. setUserId(null)                              │
│    (clears userId state - isAuthenticated       │
│     derives to false)                           │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 4. setAuthState('unauthenticated')              │
│    (marks auth state as unauthenticated)        │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 5. clearAllSelectedProjects()                   │
│    (clears all selectedProjectId:* keys)        │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 6. cacheInvalidationService.disconnect()        │
│    (closes WebSocket, prevents reconnection)    │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 7. queryClient.cancelQueries()                  │
│    (stops in-flight requests)                   │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 8. queryClient.clear()                          │
│    (wipes all cached data: projects, users,     │
│     tasks, sprints, messages, etc.)             │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ 9. localStorage cleanup:                        │
│    - removeItem('userId')                       │
│    - removeItem('REACT_QUERY_OFFLINE_CACHE')    │
│    - removeItem('token') // legacy              │
│    - remove all 'react-query*' keys             │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│ ProtectedRoute detects userId === null          │
│ Navigate to '/' (login page)                    │
└─────────────────────────────────────────────────┘
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
│ 9. ProtectedRoute detects userId === null      │
│    Navigate to '/' (login page)                │
│    (using replace to prevent back navigation)  │
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
| 9 | ProtectedRoute redirects | Redirects to login when userId === null |

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
3. clearAccessToken() - removes tokens from memory
4. AuthContext detects refresh failure (401)
5. Sets userId = null (isAuthenticated derives to false)
6. Sets authState = 'unauthenticated'
7. ProtectedRoute detects userId === null and redirects to '/'
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

**CRITICAL FIXES (2025-12-26):**
- **Proactive Token Refresh:** Implemented automatic token refresh every 5 minutes when token expires within 10 minutes. This prevents users from being logged out after 15 minutes of inactivity.
- **Fixed 401 Interceptor Logic:** Interceptor now properly detects expired tokens and refreshes them, instead of only refreshing when no token exists.

**Mobile/Background Behavior:** Always attempts refresh when page becomes visible if credentials exist, regardless of access token expiration. Since the refresh endpoint only checks the refresh token cookie (not the access token), we should always attempt refresh to ensure users stay logged in even after the app has been closed/backgrounded for days.

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

### 6. Auth State Change Event Handler (OUTDATED - Removed)

**NOTE:** This section describes the old event-based auth state handling system that has been removed. The current implementation uses direct state updates via `completeOAuthLogin()` for OAuth and direct state management for logout. See "App Initialization & Auth Bootstrap" and "OAuth Login Flow" sections above for current implementation.

### 7. Session Initialization (OUTDATED - Replaced)

**NOTE:** This section has been replaced by "App Initialization & Auth Bootstrap" section above, which describes the current implementation with `authInitialized` flag and conditional refresh logic. 


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
- **iOS Safari:** Automatically checked and disabled on iOS Safari with message "Sessions always persist on iOS Safari" (prevents session cookie logouts)

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
| `src/services/authService.ts` | Auth API calls, token storage, OAuth initiation | `login()`, `refreshToken()`, `initiateGoogleOAuth()` (forces `rememberMe=true` on iOS Safari) |
| `src/utils/isIOSSafari.ts` | iOS Safari detection utility | `isIOSSafari()` - detects iOS Safari browser |
| `src/lib/apiClient.ts` | Axios instance, interceptors, token management | `setAccessToken()`, `refreshToken()` (never refreshes if token exists), `getAccessToken()`, `clearAccessToken()` |
| `src/contexts/AuthContext.tsx` | Auth state provider, initialization | `logout()`, `initializeAuth()`, `completeOAuthLogin()`, `setOAuthMode()` |
| `src/components/ProtectedRoute.tsx` | Route guard | Redirects unauthenticated users |
| `src/components/LoginRegister.tsx` | Login/register UI, OAuth button | Apple minimalist design, Remember Me checkbox |
| `src/components/GoogleOAuthCallback.tsx` | OAuth callback handler, token extraction | Handles OAuth redirect |
| `src/hooks/useRoutePermission.js` | Project selection validation | Validates project access |
| `src/styles/login_register.css` | Login page styling | Apple minimalist styles, scoped button styles |

## Critical Rules (Lock These In)

### Refresh is Recovery, Not Validation

**The Golden Rule:** Only refresh when something is missing — never when something is fresh.

1. **Never refresh if access token exists** - If `getAccessToken()` returns a token, return it immediately without calling the backend
2. **Never clear auth on refresh 401 if access token exists** - If refresh returns 401 but access token exists, ignore the 401 (user just logged in, cookie may not be ready yet)
3. **Refresh only for recovery** - Refresh is for restoring sessions (cold start, page reload, expired token), not for validating fresh logins

**Why This Matters:**

- After login, backend sets refresh cookie, but browser may not attach it immediately
- Calling refresh immediately after login can return 401 (cookie not ready)
- If we clear auth on this 401, we incorrectly log out a user who just logged in
- Solution: If access token exists, trust it and skip refresh

**Implementation:**

- `refreshToken()` function checks `getAccessToken()` first - if token exists, returns immediately
- Response interceptor checks `getAccessToken()` before attempting refresh
- Initialization checks `getAccessToken()` before calling refresh
- All refresh 401 handlers check `getAccessToken()` before clearing auth

## Related Documentation

- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Caching Strategy](./caching_strategy.md) - React Query and cache invalidation
- [Realtime Messaging](./realtime_messaging.md) - WebSocket implementation
- [Risk Analysis](./risk_analysis.md) - Authentication risk areas and testing
- [File Reference](./file_reference.md) - Quick reference for auth-related files
- [Google OAuth Implementation](../Tasks/google_oauth.md) - Google OAuth 2.0 implementation plan
- [Fix Google OAuth Cache Leak](../Tasks/fix_google_oauth_cache_leak.md) - OAuth cache clearing strategy
- [Fix Authentication 15-Minute Logouts](../Tasks/fix_authentication_15min_logout.md) - Token refresh fixes and iOS Safari handling


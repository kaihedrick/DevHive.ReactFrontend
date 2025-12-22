# Authentication Flow - DevHive React Frontend

## Overview

The authentication system uses a dual-token approach with automatic token refresh and session persistence.

---

## 1. Login Flow

**Entry Point:** `src/pages/LoginRegister.tsx`
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

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `login()` | `authService.ts:154` | API call to authenticate |
| `storeAuthData()` | `authService.ts:32` | Store tokens and userId |
| `setAccessToken()` | `apiClient.ts:71` | Update in-memory + localStorage token |

---

## 2. Token Refresh Flow

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

### Security Measures

1. **Route Detection:** Only refresh on non-auth routes (prevents loops)
2. **User Check:** Only refresh if `userId` exists (indicates logged-in user)
3. **Request Queue:** Queue concurrent requests during refresh (prevents race conditions)
4. **Retry Flag:** Mark requests with `_retry` flag (prevents infinite loops)

---

## 3. Logout Flow

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

### Critical Logout Order

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

---

## 4. Session Initialization

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

### Key Checks

| Function | Purpose |
|----------|---------|
| `isTokenExpired()` | Checks stored `tokenExpiration` timestamp |
| `isJWTExpired()` | Decodes JWT and checks `exp` claim (WebSocket uses this) |

---

## 5. Session Persistence

### Storage Strategy

| Data | Storage | Reason |
|------|---------|--------|
| Access tokens | In-memory (primary) + localStorage (fallback) | Security + persistence |
| Refresh tokens | HTTP-only cookies | Never accessible to JS (XSS-immune) |
| User ID | localStorage | Session identification |
| Token expiration | localStorage (timestamp) | Quick expiry check |
| Selected project | localStorage (user-scoped key) | Cross-session persistence |

### Cross-Tab Synchronization

**Storage Events:** Listens for `selectedProjectId` changes (AuthContext line 293-338)
**Custom Events:** `project-changed` for same-tab updates
**WebSocket:** Reconnection on project change

---

## 6. 403 Forbidden Handling

### Two-Level Handling

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

---

## Related Files

| File | Purpose |
|------|---------|
| `src/services/authService.ts` | Auth API calls, token storage |
| `src/lib/apiClient.ts` | Axios instance, interceptors |
| `src/contexts/AuthContext.tsx` | Auth state provider |
| `src/components/ProtectedRoute.tsx` | Route guard |
| `src/hooks/useRoutePermission.js` | Project selection validation |

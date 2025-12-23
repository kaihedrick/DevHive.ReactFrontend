# Risk Analysis - DevHive React Frontend

## Overview

This document identifies risk areas in the authentication and caching systems that could cause user session issues, data loss, or security vulnerabilities.

---

## 1. HIGH RISK Areas (Could Log Out Users)

### 1.1 apiClient.ts Interceptors

**Location:** `src/lib/apiClient.ts` (lines 174-293)

**Risk:** Changes to auth route detection, refresh logic, or error handling

**Impact:**
- Premature logouts
- Infinite refresh loops
- Prevent login entirely

**Critical Code:**
```javascript
// Auth route detection (line ~180)
const isAuthRoute = (url) => {
  // Changes here affect when refresh is attempted
}

// 401 handling (line ~226)
if (error.response?.status === 401) {
  // Changes here could trigger unwanted logouts
}
```

**Testing Required:**
- [ ] Login with valid credentials
- [ ] Token refresh on 401
- [ ] Auth route detection (no refresh on login/register)
- [ ] Concurrent request handling during refresh

---

### 1.2 authService.ts - clearAuthData()

**Location:** `src/services/authService.ts` (lines 41-45)

**Risk:** Any code calling this function will log out users immediately

**Impact:** Clears tokens, userId, and project selection

**Critical Code:**
```javascript
export const clearAuthData = () => {
  clearAccessToken();
  localStorage.removeItem('userId');
  localStorage.removeItem('tokenExpiration');
};
```

**Callers (Verify each):**
- `logout()` - Expected
- Error handlers - Verify intentional

**Testing Required:**
- [ ] Verify only called on explicit logout
- [ ] Verify not called on recoverable errors

---

### 1.3 AuthContext.tsx - logout()

**Location:** `src/contexts/AuthContext.tsx` (lines 359-397)

**Risk:** Changes to logout sequence or premature auth state changes

**Impact:**
- Incomplete cleanup
- Stale data after re-login
- WebSocket reconnection issues

**Critical Order:**
1. Flag explicit logout FIRST
2. Disable queries BEFORE clearing tokens
3. Cancel requests BEFORE clearing cache
4. Disconnect WebSocket BEFORE clearing auth
5. Clear cache LAST

**Testing Required:**
- [ ] Logout clears all state
- [ ] No stale data on re-login
- [ ] WebSocket doesn't reconnect after logout

---

### 1.4 Token Refresh Logic

**Location:** `src/lib/apiClient.ts` (lines 97-132)

**Risk:** Changes to refresh endpoint, error handling, or token validation

**Impact:**
- Failed refreshes log out users
- Broken sessions

**Critical Code:**
```javascript
export const refreshToken = async () => {
  const response = await apiClient.post('/auth/refresh');
  // Error here = user logged out
};
```

**Testing Required:**
- [ ] Refresh on 401
- [ ] Refresh with expired access token
- [ ] Refresh with invalid refresh token (should logout)
- [ ] Network error during refresh

---

### 1.5 WebSocket Token Management

**Location:** `src/services/cacheInvalidationService.ts` (lines 110-159)

**Risk:** Token expiration during WebSocket connection

**Impact:**
- Connection failures
- Repeated disconnects
- Auth loops

**Critical Code:**
```javascript
async ensureFreshToken() {
  // Must return valid token or connection fails
}
```

**Testing Required:**
- [ ] WebSocket with expiring token
- [ ] Token refresh during connection
- [ ] Connection with expired token

---

## 2. MEDIUM RISK Areas

### 2.1 React Query Cache Configuration

**Location:** `src/lib/queryClient.ts`

**Risk:** Changes to staleTime, gcTime, or persistence settings

**Impact:**
- Data staleness
- Unexpected refetches
- Cache misses

**Testing Required:**
- [ ] Cache retention across navigation
- [ ] Persistence across page reloads
- [ ] Cache clearing on logout

---

### 2.2 ProtectedRoute Logic

**Location:** `src/components/ProtectedRoute.tsx` (lines 92-130)

**Risk:** Changes to auth checks or redirect conditions

**Impact:**
- Redirect loops
- Blocked access to routes
- Transient state issues

**Critical Code:**
```javascript
// Debouncing (line 46)
// Prevents redirect loops during state changes
```

**Testing Required:**
- [ ] Route navigation while authenticated
- [ ] Route navigation after logout
- [ ] Project selection requirements

---

### 2.3 WebSocket Reconnection

**Location:** `src/services/cacheInvalidationService.ts` (lines 464-535)

**Risk:** Changes to backoff, retry limits, or auth failure handling

**Impact:**
- Connection storms
- Failed reconnections
- Stale data

**Testing Required:**
- [ ] Network error recovery
- [ ] Token refresh during reconnection
- [ ] Max retry behavior

---

### 2.4 Project Selection Storage

**Location:** `src/services/storageService.js` (lines 56-115)

**Risk:** Changes to user scoping or key format

**Impact:**
- Cross-user data leakage
- Lost project selection

**Key Format:**
```javascript
`selectedProjectId:${userId}`
```

**Testing Required:**
- [ ] Multi-user scenarios
- [ ] Logout/login with different users
- [ ] Project selection persistence

---

## 3. LOW RISK Areas (Minimal Session Impact)

### 3.1 UI Components

**Files:** LoginRegister, Projects, Board, etc.

**Safe Changes:**
- Styling
- Validation messages
- User feedback

**Note:** No direct auth/cache logic

---

### 3.2 Service Layer Functions

**Files:** Individual fetch functions

**Safe Changes:**
- API endpoint changes
- Response mapping

**Note:** Auth handled by interceptor

---

### 3.3 Custom Hooks

**Files:** useProject, useBoardActions, etc.

**Safe Changes:**
- Data transformation
- State management

**Note:** Auth state consumed, not modified

---

## 4. Resolved Issues

### 4.1 Dual authService Files - FIXED

**Issue:** Both `authService.js` and `authService.ts` existed

**Resolution:** Deleted `authService.js` - TypeScript version is canonical

---

### 4.2 Axios Config Duplication - FIXED

**Issue:** `axiosConfig.js` had a 401 interceptor that immediately logged out users without attempting token refresh, conflicting with `apiClient.ts`

**Resolution:**
- Removed import from `src/index.js`
- Deleted `src/axiosConfig.js`
- `src/lib/apiClient.ts` is now the single source of truth for all auth interceptors

---

### 4.3 Critical Patterns (DO NOT REMOVE)

#### Explicit Logout Flag
```javascript
explicitLogoutRef.current = true
```
Prevents transient auth false states from triggering WebSocket reconnection.

#### Session Generation Counter
```javascript
sessionGeneration++
```
Prevents stale reconnection callbacks after logout/login.

---

## 5. Testing Checklist

### Before Any Auth/Cache Changes

#### Login Flow
- [ ] Login with valid credentials → Success
- [ ] Login with invalid credentials → Error message
- [ ] Tokens stored correctly
- [ ] userId stored correctly

#### Session Persistence
- [ ] Page refresh maintains session
- [ ] New tab maintains session
- [ ] Token expiration triggers refresh

#### Token Refresh
- [ ] 401 triggers refresh
- [ ] Refresh success continues request
- [ ] Refresh failure logs out user
- [ ] Concurrent requests wait for refresh

#### Logout Flow
- [ ] Logout clears all tokens
- [ ] Logout clears userId
- [ ] Logout clears cache
- [ ] Logout disconnects WebSocket
- [ ] Re-login works correctly

#### WebSocket
- [ ] Connects with valid token
- [ ] Reconnects on network error
- [ ] Doesn't reconnect after logout
- [ ] Handles token refresh

#### Cache
- [ ] Data cached correctly
- [ ] WebSocket invalidations work
- [ ] Cache cleared on logout
- [ ] Cache persists across reloads

---

## 6. Debugging Tools

### Browser Console

```javascript
// Check auth state
localStorage.getItem('token')
localStorage.getItem('userId')
localStorage.getItem('tokenExpiration')

// Check project selection
localStorage.getItem('selectedProjectId:' + localStorage.getItem('userId'))

// Check WebSocket
cacheInvalidationService.getConnectionStatus()

// Check cache
queryClient.getQueryData(['projects', 'list'])

// Force refresh
window.dispatchEvent(new Event('auth-state-changed'))
```

### Network Tab
- Watch for 401 responses
- Verify token in Authorization header
- Check refresh requests

### Application Tab
- localStorage values
- Cookies (refresh token)

---

## 7. Emergency Recovery

### If Users Are Getting Logged Out

1. Check `apiClient.ts` interceptors for 401 handling
2. Verify `refreshToken()` endpoint is correct
3. Check for `clearAuthData()` calls in error handlers
4. Review recent changes to `AuthContext.tsx`

### If Cache Is Stale

1. Check WebSocket connection status
2. Verify cache invalidation messages are received
3. Check `queryClient.ts` configuration
4. Review `cacheInvalidationService.ts` message handling

### If WebSocket Won't Connect

1. Check token expiration
2. Verify `ensureFreshToken()` is working
3. Check project selection
4. Review close codes for auth failures

## Related Documentation

- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Authentication Architecture](./authentication_architecture.md) - Detailed auth flows and token management
- [Caching Strategy](./caching_strategy.md) - Cache system and WebSocket invalidation
- [File Reference](./file_reference.md) - Quick reference for risk-related files


# Fix Authentication Architecture - 15-Minute Random Logouts

## Problem Statement

Users are experiencing unexpected logouts after approximately 15 minutes of activity. The issues include:

1. **Random logouts after 15 minutes** - Users are logged out even though refresh tokens should be valid for 7 days
2. **Token reset operations after expiration** - Attempting to reset/refresh tokens that are already expired
3. **Operation flow issues** - Incorrect order of operations in token refresh and logout flows

## Root Cause Analysis

After analyzing the codebase, I've identified several potential root causes:

### Issue 1: Token Expiration vs Refresh Token Confusion

**Current State:**
- Access token lifetime: 15 minutes (stored in `tokenExpiration` from JWT exp claim)
- Refresh token lifetime: 7 days (session) or 30 days (persistent/rememberMe), HTTP-only cookie

**Problem:** The 15-minute logout suggests either:
1. The backend might be returning access tokens with shorter expiration than expected
2. There's a timing issue in the token refresh logic
3. The periodic check interval (5 minutes) isn't preventing expiration during active use

**Evidence in code:**
- `apiClient.ts:6` - `TOKEN_VALIDITY_DURATION = 15 * 60 * 1000` (15 minutes, fallback only)
- `AuthContext.tsx:332-391` - Periodic check runs every 5 minutes

### Issue 2: Token Refresh Race Conditions

**Problem:** The `refreshToken()` function in `authService.ts:298-313` has a flaw:

```typescript
export const refreshToken = async (): Promise<AuthToken> => {
  try {
    const newToken = await refreshAccessToken();
    const userId = localStorage.getItem('userId');

    if (newToken && userId) {
      return { Token: newToken, userId };
    }

    throw new Error('Refresh token response missing token or userId');
  } catch (error) {
    console.error('❌ Refresh token error:', error);
    clearAuthData();  // <-- PROBLEM: Clears data on ANY error
    throw error;
  }
};
```

**Issue:** `clearAuthData()` is called on ANY refresh error, not just 401 errors. This contradicts the fix made in `apiClient.ts` where only 401 errors should trigger logout.

### Issue 3: Token Expiration Timestamp Not Updated on Refresh

**Current Flow:**
1. User logs in → `setAccessToken()` stores token + expiration timestamp
2. Token expires after 15 minutes
3. Automatic refresh triggers
4. New token stored via `setAccessToken()`
5. **New expiration timestamp is set correctly** using JWT exp claim in `apiClient.ts:190`

This part is now correct - uses actual JWT expiration instead of frontend-calculated timestamp.

### Issue 4: Proactive Refresh Window Too Small

**Current State:**
- Proactive refresh triggers 10 minutes before expiration (`AuthContext.tsx:378`)
- Periodic check runs every 5 minutes (`AuthContext.tsx:408`)

**Status:** Fixed - Proactive refresh window increased to 10 minutes, and tokens are now always refreshed on initialization/visibility change.

### Issue 5: JWT Expiration vs Stored Expiration Mismatch

**Status:** Fixed - The frontend now uses the actual JWT `exp` claim from the token instead of a frontend-calculated timestamp.

The `isJWTExpired()` function exists for WebSocket use, but the main token expiration check `isTokenExpired()` only checks localStorage timestamp.

If the backend issues a token with a shorter expiration, the frontend won't know until a 401 is returned.

## Recommended Fixes

### Fix 1: Align authService.refreshToken() with apiClient.ts Pattern

**File:** `src/services/authService.ts:298-313`

**Change:** Only clear auth data on 401 errors, not on all errors.

```typescript
export const refreshToken = async (): Promise<AuthToken> => {
  try {
    const newToken = await refreshAccessToken();
    const userId = localStorage.getItem('userId');

    if (newToken && userId) {
      return { Token: newToken, userId };
    }

    throw new Error('Refresh token response missing token or userId');
  } catch (error) {
    console.error('❌ Refresh token error:', error);
    // FIXED: Only clear auth data on 401 (refresh token expired)
    const is401 = (error as any)?.response?.status === 401 || (error as any)?.status === 401;
    if (is401) {
      clearAuthData();
    }
    throw error;
  }
};
```

### Fix 2: Use JWT Expiration Instead of Stored Timestamp

**File:** `src/lib/apiClient.ts`

**Change:** Parse the actual JWT `exp` claim instead of storing a frontend-calculated timestamp.

```typescript
// Add JWT parsing utility
export const parseJWTExpiration = (token: string): number | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.exp ? payload.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
};

// Update setAccessToken to use JWT exp
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  if (token) {
    localStorage.setItem('token', token);
    // Use actual JWT expiration instead of frontend-calculated timestamp
    const jwtExpiration = parseJWTExpiration(token);
    if (jwtExpiration) {
      localStorage.setItem(TOKEN_EXPIRATION_KEY, jwtExpiration.toString());
    } else {
      // Fallback to 15 minutes if JWT parsing fails
      const expirationTime = Date.now() + TOKEN_VALIDITY_DURATION;
      localStorage.setItem(TOKEN_EXPIRATION_KEY, expirationTime.toString());
    }
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem(TOKEN_EXPIRATION_KEY);
  }
};
```

### Fix 3: Add Buffer Time Before Expiration Check

**File:** `src/lib/apiClient.ts`

**Change:** Add a buffer to prevent edge cases where token expires between check and request.

```typescript
// Check if token is expired (with 30-second buffer)
export const isTokenExpired = (): boolean => {
  const expirationTimestamp = localStorage.getItem(TOKEN_EXPIRATION_KEY);
  if (!expirationTimestamp) {
    return !!localStorage.getItem('token');
  }

  const expirationTime = parseInt(expirationTimestamp, 10);
  const now = Date.now();
  const buffer = 30 * 1000; // 30 seconds buffer

  // Token is expired if current time + buffer is past expiration time
  return (now + buffer) > expirationTime;
};
```

### Fix 4: Increase Proactive Refresh Window

**File:** `src/contexts/AuthContext.tsx`

**Change:** Increase proactive refresh window from 5 minutes to 10 minutes.

```typescript
// In handleVisibilityChange and periodic check
const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds

// If token expires within 10 minutes, refresh proactively
if (timeUntilExpiration > 0 && timeUntilExpiration < tenMinutes) {
  // ... refresh logic
}
```

### Fix 5: Add Debug Logging for Token Expiration

**File:** `src/lib/apiClient.ts`

**Change:** Add logging to diagnose expiration issues.

```typescript
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  if (token) {
    localStorage.setItem('token', token);
    const jwtExpiration = parseJWTExpiration(token);
    if (jwtExpiration) {
      localStorage.setItem(TOKEN_EXPIRATION_KEY, jwtExpiration.toString());
      console.log('🔑 Token stored with expiration:', new Date(jwtExpiration).toISOString(),
        'TTL:', Math.round((jwtExpiration - Date.now()) / 1000 / 60), 'minutes');
    }
  }
};
```

## Implementation Plan

### Phase 1: Diagnosis (Immediate)
1. Add debug logging to `setAccessToken()` to log actual JWT expiration
2. Add logging to `isTokenExpired()` to see what values are being compared
3. Run the app and observe token expiration timing

### Phase 2: Critical Fixes
1. **Fix authService.refreshToken()** - Only clear auth on 401 (immediate fix)
2. **Use JWT expiration** - Parse actual exp claim instead of frontend timestamp
3. **Add buffer time** - Prevent race conditions with 30-second buffer

### Phase 3: Robustness Improvements
1. **Increase proactive refresh window** - From 5 to 10 minutes
2. **Add expiration mismatch detection** - Warn if JWT exp differs from expected 15 minutes
3. **Improve error handling** - More granular error types for different failure modes

### Phase 4: Verification
1. Test with network throttling
2. Test with manual clock changes
3. Test logout scenarios don't affect refresh logic
4. Monitor for 15-minute logout issues

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/authService.ts` | Fix `refreshToken()` to only clear on 401 |
| `src/lib/apiClient.ts` | Add JWT parsing, use real exp, add buffer |
| `src/contexts/AuthContext.tsx` | Increase proactive refresh window |

## Testing Checklist

- [ ] Login and verify token expiration logged correctly
- [ ] Wait for token to approach expiration, verify proactive refresh
- [ ] Simulate network error during refresh, verify no logout
- [ ] Simulate 401 during refresh, verify logout occurs
- [ ] Test across 15+ minutes without logout
- [ ] Test page visibility change triggers refresh correctly
- [ ] Test periodic check triggers refresh correctly

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing auth flow | Phase implementation, test each fix independently |
| Token parsing failure | Fallback to 15-minute timestamp |
| Browser compatibility for atob | This is widely supported, but could add try-catch |

## Related Documentation

- [Authentication Architecture](../System/authentication_architecture.md)
- [Risk Analysis](../System/risk_analysis.md)
- [File Reference](../System/file_reference.md)

## Status

- **Created:** 2025-12-23
- **Status:** ✅ Implemented (Phase 2 - iOS Safari Fixes)
- **Priority:** High (users experiencing random logouts)
- **Last Updated:** 2025-12-23

## Implementation Summary

### Phase 1 Fixes (Initial)

✅ **Fix 1:** `authService.refreshToken()` now only clears auth data on 401 errors, not on all errors
✅ **Fix 2:** Added `parseJWTExpiration()` utility to extract actual JWT `exp` claim
✅ **Fix 3:** `setAccessToken()` now uses JWT expiration instead of frontend-calculated timestamp
✅ **Fix 4:** Added 30-second buffer to `isTokenExpired()` to prevent race conditions
✅ **Fix 5:** Increased proactive refresh window from 5 to 10 minutes in both visibility change and periodic checks
✅ **Fix 6:** Added debug logging to track token expiration times and warn on mismatches

### Phase 2 Fixes (iOS Safari - 2025-12-23)

After further testing on iOS Safari, additional issues were discovered:

#### Issue: iOS Safari Cookie Not Sent After Page Reload

**Root Cause:** When iOS Safari reloads a page after being in background for 5-15 minutes, it may completely unload and reload the page. On this reload, HttpOnly cookies (like the refresh_token) are sometimes not attached to the first few network requests. This is a known iOS Safari bug.

**Symptoms:**
- User tabs out of Safari for 5-15 minutes
- User tabs back in, Safari reloads the page completely
- Token refresh fails with 401 (cookie not sent)
- User sees "No Project ID found" error
- Logout/login fixes the issue

#### Additional Fixes Implemented:

✅ **Fix 7:** Added retry logic with exponential backoff to `refreshToken()` in `apiClient.ts`
  - Retries up to 3 times on 401 errors
  - Uses exponential backoff: 150ms, 300ms, 600ms
  - Gives Safari time to properly attach cookies

✅ **Fix 8:** Added iOS/Safari detection with initial delay before refresh
  - Detects iOS devices and Safari browsers
  - Adds 100ms delay before first refresh attempt on page load
  - Allows Safari to fully initialize cookie handling

✅ **Fix 9:** Added coordination between `checkAuthState()` and response interceptor
  - Exported `setIsRefreshing` and `setAuthInitializationPromise` from apiClient
  - `checkAuthState()` now sets these flags during initialization refresh
  - Response interceptor waits for initialization refresh to complete before retrying
  - Prevents race conditions where multiple refresh calls happen concurrently

✅ **Fix 10:** Added visibility change coordination
  - `handleVisibilityChange` now also uses the refresh coordination mechanism
  - Prevents concurrent refreshes when user returns to page and queries trigger 401s

### Files Modified (Phase 2):
- `src/lib/apiClient.ts`:
  - Added `setIsRefreshing()`, `setAuthInitializationPromise()`, `getAuthInitializationPromise()` exports
  - Updated `refreshToken()` with retry logic and exponential backoff (3 retries, 150ms base delay)
  - Response interceptor now waits for `authInitializationPromise` if set
  - Added detailed logging for debugging iOS Safari issues

- `src/contexts/AuthContext.tsx`:
  - Updated imports to include new apiClient exports
  - `checkAuthState()` now sets `isRefreshing` flag and `authInitializationPromise`
  - Added iOS/Safari detection with initial 100ms delay before refresh
  - `handleVisibilityChange` now uses same coordination mechanism
  - Added more detailed logging for mobile scenarios

### Debugging iOS Safari Issues

When debugging iOS Safari token refresh issues, look for these console logs:

1. **Successful refresh:**
   ```
   📱 iOS/Safari detected, adding 100ms delay before refresh...
   🔄 Starting token refresh (attempt 1)
   ✅ Token refresh successful during initialization
   ```

2. **Retry scenario (cookie issue):**
   ```
   📱 iOS/Safari detected, adding 100ms delay before refresh...
   🔄 Starting token refresh (attempt 1)
   ❌ Refresh token failed on attempt 1: { status: 401, ... }
   ⏳ Refresh token retry 2/4 in 150ms (iOS Safari cookie fix)...
   ✅ Token refresh succeeded on retry 1
   ```

3. **Failed scenario (refresh token actually expired):**
   ```
   📱 iOS/Safari detected, adding 100ms delay before refresh...
   🔄 Starting token refresh (attempt 1)
   ❌ Refresh token failed on attempt 1: { status: 401, ... }
   ⏳ Refresh token retry 2/4 in 150ms...
   ⏳ Refresh token retry 3/4 in 300ms...
   ⏳ Refresh token retry 4/4 in 600ms...
   ⚠️ Refresh token expired (401 after all retries), clearing auth
   ```

### Testing Checklist (Updated)

- [ ] Login on iOS Safari and verify token refresh works on page load
- [ ] Tab out of Safari for 5 minutes, tab back in, verify no logout
- [ ] Tab out of Safari for 10 minutes, tab back in, verify token refreshes
- [ ] Manually refresh page while on project board, verify stays logged in
- [ ] Lock/unlock iPhone while on app, verify no logout
- [ ] Verify "No Project ID found" error no longer appears on page refresh
- [ ] Test on desktop Safari for similar behavior
- [ ] Test on Chrome (iOS) as it also uses WebKit

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
- Access token lifetime: 24 hours (stored in `tokenExpiration`)
- Refresh token lifetime: 7 days (HTTP-only cookie)

**Problem:** The 15-minute logout suggests either:
1. The backend might be returning access tokens with shorter expiration than expected
2. There's a timing issue in the token refresh logic
3. The periodic check interval (5 minutes) isn't preventing expiration during active use

**Evidence in code:**
- `apiClient.ts:6` - `TOKEN_VALIDITY_DURATION = 24 * 60 * 60 * 1000` (24 hours)
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
2. Token expires after 24 hours
3. Automatic refresh triggers
4. New token stored via `setAccessToken()`
5. **New expiration timestamp is set correctly** in `apiClient.ts:77`

This part appears correct, but let me verify there's no issue with the timestamp calculation.

### Issue 4: Proactive Refresh Window Too Small

**Current State:**
- Proactive refresh triggers 5 minutes before expiration (`AuthContext.tsx:302`)
- Periodic check runs every 5 minutes (`AuthContext.tsx:391`)

**Problem:** If the access token is only valid for 15 minutes (not 24 hours as configured), then:
- Token expires at 15 minutes
- Proactive refresh only triggers at 10 minutes
- But if periodic check runs right after token is issued (at minute 0), next check is at minute 5, then 10, then 15 (already expired)

**Hypothesis:** The backend might be issuing tokens with 15-minute expiration, but the frontend is storing 24-hour expiration timestamps.

### Issue 5: JWT Expiration vs Stored Expiration Mismatch

**Problem:** The frontend stores its own `tokenExpiration` timestamp (24 hours from login) but never validates against the actual JWT `exp` claim.

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
      // Fallback to 24 hours if JWT parsing fails
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
2. **Add expiration mismatch detection** - Warn if JWT exp differs from expected 24 hours
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
| Token parsing failure | Fallback to existing 24-hour timestamp |
| Browser compatibility for atob | This is widely supported, but could add try-catch |

## Related Documentation

- [Authentication Architecture](../System/authentication_architecture.md)
- [Risk Analysis](../System/risk_analysis.md)
- [File Reference](../System/file_reference.md)

## Status

- **Created:** 2025-12-23
- **Status:** ✅ Implemented
- **Priority:** High (users experiencing random logouts)
- **Completed:** 2025-12-23

## Implementation Summary

All fixes have been implemented:

✅ **Fix 1:** `authService.refreshToken()` now only clears auth data on 401 errors, not on all errors
✅ **Fix 2:** Added `parseJWTExpiration()` utility to extract actual JWT `exp` claim
✅ **Fix 3:** `setAccessToken()` now uses JWT expiration instead of frontend-calculated timestamp
✅ **Fix 4:** Added 30-second buffer to `isTokenExpired()` to prevent race conditions
✅ **Fix 5:** Increased proactive refresh window from 5 to 10 minutes in both visibility change and periodic checks
✅ **Fix 6:** Added debug logging to track token expiration times and warn on mismatches

### Files Modified:
- `src/services/authService.ts` - Fixed refreshToken() error handling
- `src/lib/apiClient.ts` - Added JWT parsing, updated setAccessToken(), added buffer to isTokenExpired()
- `src/contexts/AuthContext.tsx` - Increased proactive refresh window to 10 minutes

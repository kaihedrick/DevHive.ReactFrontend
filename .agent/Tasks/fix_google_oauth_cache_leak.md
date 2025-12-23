# Fix Google OAuth Cache Leak - Implementation Plan

## Issue Summary

When a user logs in via Google OAuth, they can see the **previous logged-in user's projects**. This is a data leakage bug caused by the React Query cache not being cleared when a different user logs in.

## Root Cause Analysis

### Current Flow (Broken)

```
1. User A logs in
   ├── Auth tokens stored in localStorage
   ├── Projects fetched → cached in React Query as ['projects', 'list']
   └── Project selected → stored as `selectedProjectId:userA_id`

2. User A closes browser (no explicit logout)

3. User B logs in via Google OAuth
   ├── GoogleOAuthCallback component receives token from URL hash
   ├── storeAuthData(token, userB_id) called
   │   └── Only stores new tokens, does NOT check for previous user
   ├── Dispatches 'auth-state-changed' event
   │   └── AuthContext handler only handles logout (no tokens case)
   └── React Query cache STILL has User A's projects! ← BUG

4. User B navigates to /projects
   └── React Query returns cached projects (User A's data!) ← DATA LEAK
```

### The Problem

1. **`GoogleOAuthCallback.tsx`** (line 37): Calls `storeAuthData()` directly without checking for existing user
2. **`storeAuthData()`** (authService.ts line 32-36): Only stores new data, doesn't clear old data
3. **`auth-state-changed` handler** (AuthContext.tsx line 134-146): Only handles logout case (`!hasToken || !storedUserId`), doesn't detect user change
4. **React Query cache**: Uses `['projects', 'list']` key for ALL users - not user-scoped

### Why Normal Login Doesn't Have This Issue

Normal login through `AuthContext.login()` doesn't have this issue because:
- User typically logs out first (which clears cache)
- Or the session expires and auth state is reset

But Google OAuth can redirect directly to the callback without going through logout.

---

## Solution Design

### Approach: Clear Previous User Data Before Storing New Auth

When processing the OAuth callback, we need to:
1. Check if there's an existing authenticated user
2. If the new userId differs from the old userId, clear all previous user data
3. Then store the new user's auth data

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/GoogleOAuthCallback.tsx` | Add user change detection and cache clearing |
| `src/services/authService.ts` | (Optional) Add helper function for clearing previous user data |

---

## Implementation Steps

### Step 1: Modify GoogleOAuthCallback.tsx

**Current Code (line 24-60):**
```typescript
useEffect(() => {
  const hash = window.location.hash;

  if (hash.startsWith('#token=')) {
    try {
      const tokenDataEncoded = hash.substring(7);
      const tokenDataJSON = atob(tokenDataEncoded);
      const tokenData = JSON.parse(tokenDataJSON);

      // ❌ BUG: Stores new auth without clearing old user data
      storeAuthData(tokenData.token, tokenData.userId);

      // ... rest of logic
    }
  }
}, [navigate]);
```

**Fixed Code:**
```typescript
import { useQueryClient } from '@tanstack/react-query';
import { storeAuthData, getUserId } from '../services/authService.ts';
import { clearSelectedProject } from '../services/storageService';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';

// Inside component:
const queryClient = useQueryClient();

useEffect(() => {
  const hash = window.location.hash;

  if (hash.startsWith('#token=')) {
    try {
      const tokenDataEncoded = hash.substring(7);
      const tokenDataJSON = atob(tokenDataEncoded);
      const tokenData = JSON.parse(tokenDataJSON);

      // ✅ FIX: Check if switching users and clear old data
      const previousUserId = getUserId();
      if (previousUserId && previousUserId !== tokenData.userId) {
        console.log('🔄 User changed during OAuth, clearing previous user data');

        // 1. Disconnect WebSocket (must be done before clearing cache)
        cacheInvalidationService.disconnect('User changed during OAuth');

        // 2. Clear previous user's project selection
        clearSelectedProject(previousUserId);

        // 3. Clear React Query cache (removes old user's data)
        queryClient.clear();
      }

      // Store the new user's auth data
      storeAuthData(tokenData.token, tokenData.userId);

      // ... rest of logic
    }
  }
}, [navigate, queryClient]);
```

### Step 2: Add Imports

Add these imports to `GoogleOAuthCallback.tsx`:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { storeAuthData, getUserId } from '../services/authService.ts';
import { clearSelectedProject } from '../services/storageService';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
```

### Step 3: Update Component to Use QueryClient

The component needs access to the QueryClient to clear the cache:

```typescript
const GoogleOAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient(); // Add this
  // ... rest
};
```

---

## Detailed Code Changes

### File: `src/components/GoogleOAuthCallback.tsx`

```diff
 import React, { useEffect, useState } from 'react';
 import { useNavigate } from 'react-router-dom';
-import { storeAuthData } from '../services/authService.ts';
+import { useQueryClient } from '@tanstack/react-query';
+import { storeAuthData, getUserId } from '../services/authService.ts';
+import { clearSelectedProject } from '../services/storageService';
+import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
 import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
 import { faSpinner } from '@fortawesome/free-solid-svg-icons';
 import '../styles/login_register.css';

 const GoogleOAuthCallback: React.FC = () => {
   const navigate = useNavigate();
+  const queryClient = useQueryClient();
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
     const hash = window.location.hash;

     if (hash.startsWith('#token=')) {
       try {
         const tokenDataEncoded = hash.substring(7);
         const tokenDataJSON = atob(tokenDataEncoded);
         const tokenData = JSON.parse(tokenDataJSON);

+        // Check if switching users - if so, clear previous user's cached data
+        const previousUserId = getUserId();
+        if (previousUserId && previousUserId !== tokenData.userId) {
+          console.log('🔄 User changed during OAuth login, clearing previous user data', {
+            previousUserId,
+            newUserId: tokenData.userId
+          });
+
+          // 1. Disconnect WebSocket to prevent stale connections
+          cacheInvalidationService.disconnect('User changed during OAuth');
+
+          // 2. Clear previous user's project selection
+          clearSelectedProject(previousUserId);
+
+          // 3. Clear React Query cache to remove old user's data
+          queryClient.clear();
+        }
+
         // Store the new user's auth data
         storeAuthData(tokenData.token, tokenData.userId);

         console.log('✅ OAuth token stored from URL hash', {
           userId: tokenData.userId,
-          isNewUser: tokenData.isNewUser
+          isNewUser: tokenData.isNewUser,
+          userChanged: previousUserId !== tokenData.userId
         });

         // ... rest unchanged
       }
     }
-  }, [navigate]);
+  }, [navigate, queryClient]);
```

---

## Testing Plan

### Test Case 1: User Switch via Google OAuth
1. Login as User A (via password or Google)
2. Navigate to projects, select a project
3. Note User A's project list
4. WITHOUT logging out, navigate to login page
5. Login as User B via Google OAuth
6. Verify: User B should NOT see User A's projects
7. Verify: User B's project selection should be empty

### Test Case 2: Same User Re-login
1. Login as User A via password
2. Navigate to projects
3. Login again as User A via Google OAuth
4. Verify: User A still sees their own projects (no unnecessary cache clear)

### Test Case 3: Fresh OAuth Login
1. Clear all localStorage
2. Login via Google OAuth as User A
3. Verify: Projects load correctly
4. Verify: No errors in console about clearing non-existent data

### Console Log Verification

When user switches, you should see:
```
🔄 User changed during OAuth login, clearing previous user data {previousUserId: "...", newUserId: "..."}
🔌 WebSocket disconnected: User changed during OAuth
✅ OAuth token stored from URL hash {userId: "...", isNewUser: false, userChanged: true}
```

---

## Security Considerations

This fix addresses a **data leakage vulnerability** where:
- User B could potentially see User A's project names and data
- User B might access projects they're not authorized for

The fix ensures complete data isolation between user sessions.

---

## Alternative Approaches Considered

### Option A: Modify AuthContext Event Handler (Rejected)
- Could modify `auth-state-changed` handler to detect userId changes
- Rejected because: Event handler doesn't have access to the NEW userId before storage
- The callback component is the only place with both old and new userIds

### Option B: Always Clear Cache on OAuth (Rejected)
- Could always clear cache when processing OAuth callback
- Rejected because: Unnecessary for same-user re-login scenarios
- Would cause unnecessary data refetching

### Option C: Scope React Query Cache by UserId (Future Enhancement)
- Could prefix all query keys with userId
- More comprehensive solution but requires significant refactoring
- Could be considered as future improvement

---

## Rollback Plan

If issues arise:
1. Revert changes to `GoogleOAuthCallback.tsx`
2. No database changes required
3. No backend changes required

---

## Success Criteria

- [ ] User switching via Google OAuth clears previous user's cache
- [ ] Same-user OAuth re-login doesn't unnecessarily clear cache
- [ ] Fresh OAuth login works correctly
- [ ] No console errors during OAuth flow
- [ ] WebSocket properly reconnects after user switch
- [ ] Project selection is properly reset for new user

---

## Related Documentation

- [Authentication Architecture](../System/authentication_architecture.md) - Auth flow details
- [Caching Strategy](../System/caching_strategy.md) - React Query cache patterns
- [Google OAuth Implementation](./google_oauth.md) - OAuth implementation plan

---

**Status:** Ready for Implementation
**Priority:** High (Security/Data Leak)
**Estimated Effort:** 30 minutes
**Risk:** Low (isolated change to OAuth callback)

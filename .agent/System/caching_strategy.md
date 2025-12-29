# Caching Strategy - DevHive React Frontend

## Overview

The caching system uses React Query with WebSocket-driven cache invalidation for real-time data synchronization.

**Latest Updates (2025-12-28)**:
- **WebSocket Fallback Refetch** - Added fallback refetch on message send success to ensure messages update even if WebSocket invalidation fails. See [Error Handling SOP](../SOP/error_handling.md) for details.
- **Multi-Source ProjectId Extraction** - WebSocket event handlers now extract projectId from multiple sources (camelCase, snake_case, nested, subscribed project) with proper fallbacks and empty-string safety checks.
- **WebSocket Subscribe Payload** - Subscribe payload and event handlers updated to use camelCase `projectId` to match AWS Lambda backend requirements. See [Realtime Messaging](./realtime_messaging.md) for details.

---

## 1. React Query Configuration

**File:** `src/lib/queryClient.ts`

### Default Options

```javascript
QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,              // Never auto-refetch
      gcTime: 24 * 60 * 60 * 1000,     // 24h retention
      refetchOnWindowFocus: false,      // Disable auto-refetch
      refetchOnReconnect: false,        // Disable auto-refetch
      refetchOnMount: false,            // Use cache if available
      retry: 1,                         // Retry once on failure
    }
  }
})
```

### Cache Strategy

| Setting | Value | Purpose |
|---------|-------|---------|
| `staleTime` | Infinity | Never auto-refetch (relies on WebSocket) |
| `gcTime` | 24 hours | Long retention for offline support |
| `refetchOnWindowFocus` | false | Prevent unnecessary API calls |
| `refetchOnReconnect` | false | WebSocket handles updates |
| `refetchOnMount` | false | Use cache if available |

### Persistence Configuration

**CRITICAL SECURITY: User-Scoped Cache Persistence**

Cache persistence is **dynamically scoped per user** to prevent cache leakage between users during login/logout/OAuth flows.

```javascript
// User-scoped cache key (e.g., "REACT_QUERY_OFFLINE_CACHE:user-uuid")
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: `REACT_QUERY_OFFLINE_CACHE:${userId}`,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 24 * 60 * 60 * 1000,      // 24h expiration
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.data !== undefined
  }
})
```

**Lifecycle:**
- **Login/OAuth:** `setupUserScopedPersistence(userId)` creates user-specific persister
- **Logout:** `clearUserScopedPersistence()` removes persister and clears user's cache
- **User Switch:** Old persister is cleaned up, new persister is created for new user

**Benefits:**
- **No cache leakage:** Each user has isolated localStorage namespace
- **No manual clearing:** User switching automatically uses correct cache
- **No race conditions:** Cache operations are scoped, eliminating timing issues
- **Offline support:** Each user's cache persists across sessions

### Implementation Details

**File:** `src/lib/queryClient.ts`

**Exported Functions:**

```typescript
// Setup user-scoped persistence (called on login, OAuth completion, token refresh)
setupUserScopedPersistence(userId: string): void

// Clear user-scoped persistence (called on logout)
clearUserScopedPersistence(): void

// Remove cache for a specific user (utility function)
removeUserCache(userId: string): void

// Clean up legacy unscoped cache (migration)
removeLegacyCache(): void
```

**Integration Points:**

| Event | File | Function | Action |
|-------|------|----------|--------|
| Login | `AuthContext.tsx` | `login()` | Clear old persister → Setup new persister |
| OAuth Login | `AuthContext.tsx` | `completeOAuthLogin()` | Clear old persister → Setup new persister |
| Token Refresh | `AuthContext.tsx` | `refreshToken()` | Setup persister if not already set |
| Logout | `AuthContext.tsx` | `logout()` | Clear persister and remove cache |
| Auth Init | `AuthContext.tsx` | `initializeAuth()` | Setup persister if user exists |

**localStorage Keys:**

```
REACT_QUERY_OFFLINE_CACHE:user-uuid-1   // User 1's cache
REACT_QUERY_OFFLINE_CACHE:user-uuid-2   // User 2's cache
REACT_QUERY_OFFLINE_CACHE               // Legacy (removed on login/logout)
```

**Migration Strategy:**

The system automatically removes the legacy unscoped cache (`REACT_QUERY_OFFLINE_CACHE`) on:
- Login
- OAuth login
- Logout

This ensures gradual migration from the old unscoped format to the new user-scoped format.

---

## 2. Cache Query Keys

### Key Patterns

```javascript
// Projects
['projects', 'list']                    // All projects for user
['projects', projectId]                 // Single project
['projects', 'detail', projectId]       // Project details
['projects', 'bundle', projectId]       // Project with sprints/tasks

// Sprints
['sprints', 'list', projectId]          // All sprints for project
['sprints', sprintId]                   // Single sprint
['sprints', 'detail', sprintId]         // Sprint details

// Tasks
['tasks', 'list', 'project', projectId] // All tasks for project
['tasks', 'list', 'sprint', sprintId]   // All tasks for sprint
['tasks', taskId]                       // Single task
['tasks', 'detail', taskId]             // Task details

// Members
['projectMembers', projectId]           // Members for project

// Messages (User-Scoped)
['messages', 'list', 'user', userId, 'project', projectId]  // Messages for project (user-scoped)
```

### User-Scoped Query Keys

**IMPORTANT:** Message queries are user-scoped to prevent cross-user cache contamination. Each user has their own cache namespace:

```javascript
// User A's messages for project1
['messages', 'list', 'user', 'userA-id', 'project', 'project1']

// User B's messages for project1 (separate cache)
['messages', 'list', 'user', 'userB-id', 'project', 'project1']
```

This ensures:
- Different users never share cached message data
- OAuth login/logout doesn't show previous user's messages
- Cache invalidation targets the correct user's data

---

## 3. WebSocket Cache Invalidation

**File:** `src/services/cacheInvalidationService.ts`

### Connection Flow

```
┌───────────────────────────────────────────────────────────────┐
│ AuthContext detects: isAuthenticated && selectedProjectId    │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ cacheInvalidationService.connect(projectId)                   │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ ensureFreshToken()                                            │
│ - Check JWT exp claim                                         │
│ - Refresh if expiring within 10min (600s)                     │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ WebSocket URL:                                                │
│ wss://ws.devhive.it.com?token={jwt}                           │
│ (Production: AWS API Gateway)                                │
│ OR ws://localhost:8080/api/v1/messages/ws?token={jwt}        │
│ (Development: Go backend)                                    │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ ws.onopen → Send subscribe message + start heartbeat (30s)   │
│ { action: 'subscribe', projectId: 'uuid' } ← camelCase!      │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ ws.onmessage → handleMessage() with event-specific invalidation │
└───────────────────────────────────────────────────────────────┘
```

### Event-Based Message Format

Backend sends specific event types instead of generic cache_invalidate messages:

```javascript
// Member events (backend sends camelCase projectId)
{ type: 'member_added', projectId: 'uuid' }
{ type: 'member_removed', projectId: 'uuid' }

// Message events
{ type: 'message_created', projectId: 'uuid' }

// Task events
{ type: 'task_created', projectId: 'uuid' }
{ type: 'task_updated', projectId: 'uuid' }
{ type: 'task_deleted', projectId: 'uuid' }

// Sprint events
{ type: 'sprint_created', projectId: 'uuid' }
{ type: 'sprint_updated', projectId: 'uuid' }
{ type: 'sprint_deleted', projectId: 'uuid' }

// Project events
{ type: 'project_updated', projectId: 'uuid' }

// Note: Frontend prioritizes projectId (camelCase) but also supports
// project_id (snake_case) for backward compatibility
```

### Cache Invalidate Payload Formats

**IMPORTANT:** Frontend supports **both nested and flat** payload formats for backward compatibility and future-proofing:

**Format 1: Nested Payload (Preferred)**
```javascript
{
  type: 'cache_invalidate',
  data: {
    resource: 'message',
    id: 'message-uuid',
    action: 'INSERT',
    project_id: 'project-uuid',
    timestamp: '2024-01-15T10:30:00Z'
  }
}
```

**Format 2: Flat Payload (Legacy)**
```javascript
{
  type: 'cache_invalidate',
  resource: 'message',
  id: 'message-uuid',
  action: 'INSERT',
  project_id: 'project-uuid',
  timestamp: '2024-01-15T10:30:00Z'
}
```

**Frontend Handler:**
```javascript
case 'cache_invalidate': {
  console.log('📦 cache_invalidate message received');

  // NEW: nested payload support
  if (message.data && typeof message.data === 'object' && 'resource' in message.data) {
    this.handleCacheInvalidation(message.data as CacheInvalidationPayload);
    break;
  }

  // Existing: flat payload support
  if (message.resource) {
    const payload: CacheInvalidationPayload = {
      resource: message.resource as CacheInvalidationPayload['resource'],
      id: (message as any).id || (message as any).user_id || '',
      action: (message as any).action as CacheInvalidationPayload['action'],
      project_id: (message as any).project_id || message.project_id || '',
      timestamp: (message as any).timestamp || new Date().toISOString(),
    };
    this.handleCacheInvalidation(payload);
    break;
  }

  console.warn('⚠️ Invalid cache_invalidate format:', message);
  break;
}
```

### Invalidation Logic

**File:** `cacheInvalidationService.ts`

#### Predicate-Based Invalidation (Messages)

**CRITICAL DESIGN:** Message cache invalidation uses **predicate functions** instead of exact query keys. This eliminates dependency on `userId` from localStorage and ensures all users receive real-time updates:

```javascript
/**
 * Invalidates all message queries for a given project using predicate matching.
 * Matches any user-scoped message query for the project, regardless of userId.
 * Uses refetchType: 'active' to ensure the open chat refetches immediately.
 */
private invalidateProjectMessages(projectId: string): void {
  queryClient.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey;
      return (
        Array.isArray(k) &&
        k[0] === 'messages' &&
        k.includes('project') &&
        k.includes(projectId)
      );
    },
    // ensures the open chat refetches immediately
    refetchType: 'active',
  });
}
```

**Why Predicate Matching?**
1. **No localStorage dependency:** Eliminates stale userId reads from localStorage
2. **Universal invalidation:** Matches any user's message query for the project
3. **Immediate refetch:** `refetchType: 'active'` ensures active chats update instantly
4. **Simpler logic:** WebSocket layer only needs to know projectId, not userId

**Usage in Event Handlers:**
```javascript
// message_created event (prioritize camelCase projectId)
case 'message_created': {
  const projectId = message.projectId || message.project_id || '';
  console.log(`💬 Message created for project ${projectId}`);
  this.invalidateProjectMessages(projectId);
  break;
}

// cache_invalidate event (legacy/nested payload support)
case 'message': {
  // Prioritize camelCase projectId over snake_case project_id
  const projectId = payload.projectId || payload.project_id;
  this.invalidateProjectMessages(projectId);
  console.log(`✅ Invalidated message caches for project ${projectId}`);
  break;
}
```

#### Query Key-Based Invalidation (Other Resources)

```javascript
switch (resource) {
  case 'project':
    // Invalidate project-specific queries
    invalidateQueries(['projects', id])
    invalidateQueries(['projects', 'list'])
    if (action === 'DELETE') {
      // Remove from cache entirely
      removeQueries(['projects', id])
    }
    break;

  case 'sprint':
    // Invalidate sprint and related queries
    invalidateQueries(['sprints', id])
    invalidateQueries(['sprints', 'list', project_id])
    invalidateQueries(['projects', 'bundle', project_id])
    if (action === 'INSERT') {
      // Immediate refetch for new sprints
      refetchQueries(['sprints', 'list', project_id])
    }
    break;

  case 'task':
    // Invalidate task and related queries
    invalidateQueries(['tasks', id])
    invalidateQueries(['tasks', 'list', 'project', project_id])
    invalidateQueries(['tasks', 'list', 'sprint']) // All sprints
    break;

  case 'project_members':
    // Immediate refetch for member changes
    refetchQueries(['projectMembers', project_id])
    refetchQueries(['projects', 'bundle', project_id])
    invalidateQueries(['projects', 'list'])
    break;
}
```

---

## 4. Message Sending Flow & Cache Invalidation

**File:** `src/hooks/useMessages.ts`

### Design: Single Invalidation via WebSocket

**CRITICAL:** Message cache invalidation happens **only via WebSocket**, not in the mutation's `onSuccess` handler. This prevents double-fetch issues.

```javascript
/**
 * Hook to send a message using React Query mutation
 * @returns Mutation hook for sending messages
 *
 * NOTE: Cache invalidation is handled by WebSocket (message_created event).
 * No manual invalidation needed here to avoid double-fetch.
 */
export const useSendMessage = () => {
  return useMutation({
    mutationFn: (messageData: { projectId: string; content: string; messageType?: string; parentMessageId?: string }) =>
      sendMessage(messageData),
    // No onSuccess invalidation - WebSocket handles cache invalidation
  });
};
```

### Why Single Invalidation?

**Before (Double-Fetch Issue):**
```
User sends message
  → POST /api/v1/projects/{projectId}/messages
  → onSuccess: invalidateQueries(['messages', ...])   ← First fetch
  → Backend broadcasts message_created via WebSocket
  → WebSocket handler: invalidateQueries(['messages', ...])  ← Second fetch (DUPLICATE!)
```

**After (Single Fetch):**
```
User sends message
  → POST /api/v1/projects/{projectId}/messages
  → Backend broadcasts message_created via WebSocket
  → WebSocket handler: invalidateProjectMessages(projectId)  ← Only fetch
  → refetchType: 'active' ensures immediate update
```

### Benefits

1. **No duplicate fetches:** Only one refetch per message sent
2. **Consistent updates:** All clients (sender + receivers) use the same invalidation path
3. **Simpler logic:** Cache invalidation centralized in WebSocket handler
4. **Better UX:** Faster message display (no waiting for duplicate fetch)

### Optional: Optimistic Updates

For even better UX, consider optimistic updates with `setQueryData`:

```javascript
onMutate: async (newMessage) => {
  // Cancel outgoing refetches
  await queryClient.cancelQueries(['messages', 'list', 'user', userId, 'project', projectId]);

  // Snapshot previous value
  const previousMessages = queryClient.getQueryData(['messages', 'list', 'user', userId, 'project', projectId]);

  // Optimistically update to the new value
  queryClient.setQueryData(['messages', 'list', 'user', userId, 'project', projectId], (old) => {
    return {
      ...old,
      messages: [...old.messages, { id: 'temp-id', ...newMessage, createdAt: new Date() }]
    };
  });

  return { previousMessages };
},
onError: (err, newMessage, context) => {
  // Rollback on error
  queryClient.setQueryData(['messages', 'list', 'user', userId, 'project', projectId], context.previousMessages);
},
onSettled: () => {
  // WebSocket will handle the actual refetch when message_created event arrives
}
```

---

## 6. WebSocket Reconnection Strategy

**File:** `cacheInvalidationService.ts` (lines 464-535)

### Exponential Backoff

| Attempt | Delay | Cumulative |
|---------|-------|------------|
| 1 | 1s | 1s |
| 2 | 2s | 3s |
| 3 | 4s | 7s |
| 4 | 8s | 15s |
| 5 | 16s | 31s |
| 6+ | 30s (max) | - |

### Reconnection Conditions

```javascript
// Will reconnect:
- Network errors
- Server restarts
- Temporary failures

// Will NOT reconnect:
- Auth failures (401, 4003)
- Forbidden (1008 with 'not authorized')
- Explicit disconnect
- Logout

// Special handling:
- Token refresh on 401/1006/1008
- Session generation tracking
```

### Session Generation

```javascript
// Prevents stale reconnections after logout/login
let sessionGeneration = 0;

connect(projectId) {
  sessionGeneration++;
  const currentSession = sessionGeneration;

  // All callbacks check: if (sessionGeneration !== currentSession) return;
}

disconnect() {
  sessionGeneration++;
}
```

---

## 7. Cache Invalidation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Backend database change (INSERT/UPDATE/DELETE)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL trigger fires                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ NOTIFY sent via pg_notify                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend WebSocket handler receives NOTIFY                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend sends to all connected clients for project:         │
│ { type: 'cache_invalidate', data: {...} }                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ cacheInvalidationService.handleMessage()                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ handleCacheInvalidation(payload)                            │
│ - Switch on resource type                                   │
│ - Call queryClient.invalidateQueries() or refetchQueries()  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ React Query marks queries as stale                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Active components automatically refetch                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ UI updates with fresh data                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Token Management for WebSocket

**File:** `cacheInvalidationService.ts` (lines 110-159)

### ensureFreshToken() Flow

```
┌─────────────────────────────────────────┐
│ connect(projectId) called               │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ ensureFreshToken()                      │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ 1. Get fresh token (ALWAYS from live   │
│    source, never cached)                │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ 2. Decode JWT and check exp claim       │
│    (with 30s buffer)                    │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ 3. IF expires within 30s:               │
│    refreshToken()                       │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ 4. Return fresh token                   │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ Build WebSocket URL with token          │
│ in query param                          │
└─────────────────────────────────────────┘
```

### Why Token in Query Param?

Browser WebSocket constructor doesn't support custom headers. Token MUST be in URL query param for browser compatibility.

---

## 9. Debugging Cache

### Browser Console Commands

```javascript
// Check React Query cache
queryClient.getQueryData(['projects', 'list'])
queryClient.getQueryData(['sprints', 'list', 'projectId'])

// Force invalidation
queryClient.invalidateQueries(['projects'])

// Check WebSocket status
cacheInvalidationService.getConnectionStatus()

// Check localStorage cache
localStorage.getItem('REACT_QUERY_OFFLINE_CACHE')
```

### React Query DevTools

The app includes React Query DevTools (in development) for cache inspection.

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/queryClient.ts` | React Query configuration |
| `src/services/cacheInvalidationService.ts` | WebSocket cache sync |
| `src/contexts/AuthContext.tsx` | WebSocket connection management |
| `src/hooks/useProject.ts` | Project data hooks |
| `src/hooks/useSprints.ts` | Sprint data hooks |

## Related Documentation

- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Authentication Architecture](./authentication_architecture.md) - Token management and auth flows
- [Realtime Messaging](./realtime_messaging.md) - WebSocket implementation details
- [File Reference](./file_reference.md) - Quick reference for cache-related files


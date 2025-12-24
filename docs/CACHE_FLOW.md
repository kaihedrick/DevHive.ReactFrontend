# Caching Flow - DevHive React Frontend

## Overview

The caching system uses React Query with WebSocket-driven cache invalidation for real-time data synchronization.

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

```javascript
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
  maxAge: 24 * 60 * 60 * 1000,      // 24h expiration
  key: 'REACT_QUERY_OFFLINE_CACHE',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.data !== undefined
  }
})
```

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
```

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
│ - Refresh if expiring within 30s                              │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ WebSocket URL:                                                │
│ wss://go.devhive.it.com/api/v1/messages/ws          │
│ ?project_id={id}&token={jwt}                                 │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ ws.onopen → Send init message + start heartbeat (30s)        │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│ ws.onmessage → handleCacheInvalidation()                     │
└───────────────────────────────────────────────────────────────┘
```

### Message Format

```javascript
{
  type: 'cache_invalidate',
  data: {
    resource: 'project' | 'sprint' | 'task' | 'project_members',
    id: 'uuid',
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    project_id: 'uuid',
    timestamp: 'ISO 8601'
  }
}
```

### Invalidation Logic

**File:** `cacheInvalidationService.ts` (lines 569-653)

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

## 4. WebSocket Reconnection Strategy

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

## 5. Cache Invalidation Flow

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

## 6. Token Management for WebSocket

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

## 7. Debugging Cache

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

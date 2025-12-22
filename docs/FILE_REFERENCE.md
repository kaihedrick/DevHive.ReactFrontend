# File Reference Map - DevHive React Frontend

## Quick Reference

This document provides a quick lookup for all authentication and caching related files with their key line numbers.

---

## Authentication Core

### authService.ts
**Path:** `src/services/authService.ts`

| Function | Line | Purpose |
|----------|------|---------|
| `storeAuthData()` | 32 | Store tokens and userId |
| `clearAuthData()` | 41 | Clear all auth data (CAUSES LOGOUT) |
| `isTokenExpired()` | 50 | Check token expiration |
| `login()` | 154 | API login call |
| `logout()` | 180 | API logout call |
| `refreshTokenService()` | 190 | Token refresh call |

---

### apiClient.ts
**Path:** `src/lib/apiClient.ts`

| Section | Lines | Purpose |
|---------|-------|---------|
| In-memory token | 8-9 | `accessToken` variable |
| `setAccessToken()` | 71 | Update token (memory + localStorage) |
| `clearAccessToken()` | 80 | Clear token |
| `getAccessToken()` | 85 | Get current token |
| `refreshToken()` | 97-132 | Token refresh API call |
| Request interceptor | 174-205 | Add auth header |
| Response interceptor (401) | 206-293 | Handle 401, trigger refresh |
| Response interceptor (403) | 298-347 | Handle forbidden projects |

---

### AuthContext.tsx
**Path:** `src/contexts/AuthContext.tsx`

| Section | Lines | Purpose |
|---------|-------|---------|
| State initialization | 50-75 | Auth state setup |
| `checkAuthState()` | 80-153 | Session initialization |
| Storage event listener | 293-338 | Cross-tab sync |
| `logout()` | 359-397 | Complete logout flow |
| WebSocket connection | 400-450 | Connect on auth + project |

---

## Caching Core

### queryClient.ts
**Path:** `src/lib/queryClient.ts`

| Section | Lines | Purpose |
|---------|-------|---------|
| Default options | 10-25 | staleTime, gcTime, retry |
| Persistence config | 30-50 | localStorage persister |

---

### cacheInvalidationService.ts
**Path:** `src/services/cacheInvalidationService.ts`

| Section | Lines | Purpose |
|---------|-------|---------|
| `ensureFreshToken()` | 110-159 | Get valid token for WebSocket |
| `connect()` | 160-250 | WebSocket connection |
| `disconnect()` | 260-300 | Clean disconnection |
| Close handler | 308-341 | Handle auth failures |
| Reconnection logic | 464-535 | Exponential backoff |
| `handleCacheInvalidation()` | 569-653 | Process invalidation messages |

---

## Route Protection

### ProtectedRoute.tsx
**Path:** `src/components/ProtectedRoute.tsx`

| Section | Lines | Purpose |
|---------|-------|---------|
| Auth checks | 30-50 | Verify authenticated |
| Project checks | 55-85 | Verify project access |
| Debounce logic | 46 | Prevent redirect loops |
| Render logic | 92-130 | Conditional rendering |

---

### useRoutePermission.js
**Path:** `src/hooks/useRoutePermission.js`

| Function | Purpose |
|----------|---------|
| `useRoutePermission()` | Check project selection for route |

---

## Storage

### storageService.js
**Path:** `src/services/storageService.js`

| Section | Lines | Purpose |
|---------|-------|---------|
| `setSelectedProject()` | 56-75 | Store project (user-scoped) |
| `getSelectedProject()` | 80-95 | Get project for user |
| `clearSelectedProject()` | 100-115 | Clear project selection |

---

## Configuration

### config.js
**Path:** `src/config.js`

| Export | Purpose |
|--------|---------|
| `API_BASE_URL` | Backend API endpoint |
| `WS_BASE_URL` | WebSocket endpoint |

---

## Entry Points

### index.js
**Path:** `src/index.js`

| Section | Purpose |
|---------|---------|
| Provider order | QueryClient → Auth → Toast → Router |

### App.js
**Path:** `src/App.js`

| Section | Purpose |
|---------|---------|
| Routes | All application routes |

### AppContent.js
**Path:** `src/components/AppContent.js`

| Section | Purpose |
|---------|---------|
| Layout | Main app layout with header |

---

## Data Hooks

### useProject.ts
**Path:** `src/hooks/useProject.ts`

| Hook | Purpose |
|------|---------|
| `useProject()` | Fetch single project |
| `useProjects()` | Fetch all projects |
| `useProjectBundle()` | Project with sprints/tasks |

### useSprints.ts
**Path:** `src/hooks/useSprints.ts`

| Hook | Purpose |
|------|---------|
| `useSprints()` | Fetch sprints for project |
| `useSprint()` | Fetch single sprint |

### useTasks.ts
**Path:** `src/hooks/useTasks.ts`

| Hook | Purpose |
|------|---------|
| `useTasks()` | Fetch tasks for project/sprint |
| `useTask()` | Fetch single task |

---

## Quick Find by Concern

### Token Storage
- In-memory: `src/lib/apiClient.ts:8-9`
- localStorage: `src/services/authService.ts:32`

### Token Refresh
- API call: `src/lib/apiClient.ts:97-132`
- Trigger: `src/lib/apiClient.ts:226` (401 interceptor)

### Logout
- Full flow: `src/contexts/AuthContext.tsx:359-397`
- Clear data: `src/services/authService.ts:41-45`

### WebSocket Connection
- Connect: `src/services/cacheInvalidationService.ts:160-250`
- Token check: `src/services/cacheInvalidationService.ts:110-159`
- Reconnection: `src/services/cacheInvalidationService.ts:464-535`

### Cache Invalidation
- Message handling: `src/services/cacheInvalidationService.ts:569-653`
- Query keys: `src/lib/queryClient.ts`

### Route Protection
- Component: `src/components/ProtectedRoute.tsx`
- Hook: `src/hooks/useRoutePermission.js`

### Project Selection
- Storage: `src/services/storageService.js:56-115`
- Context: `src/contexts/AuthContext.tsx:293-338`

---

## Dependency Graph

```
AuthContext
├── authService (login, logout, refresh)
│   └── apiClient (axios instance)
│       └── interceptors (auth header, 401 handling)
├── cacheInvalidationService (WebSocket)
│   └── apiClient (token refresh)
├── storageService (project selection)
└── queryClient (cache management)

ProtectedRoute
├── AuthContext (isAuthenticated)
└── useRoutePermission (project check)
    └── storageService (get selected project)
```

---

## Import Paths

```javascript
// Auth
import { login, logout } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/lib/apiClient';

// Cache
import { queryClient } from '@/lib/queryClient';
import cacheInvalidationService from '@/services/cacheInvalidationService';

// Storage
import { getSelectedProject, setSelectedProject } from '@/services/storageService';

// Route Protection
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRoutePermission } from '@/hooks/useRoutePermission';
```

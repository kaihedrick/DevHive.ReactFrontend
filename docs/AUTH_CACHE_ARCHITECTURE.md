# Auth/Cache Flow Architecture - DevHive React Frontend

## Executive Summary

This React frontend implements a sophisticated authentication and caching architecture with:
- **Dual-token system**: Access tokens (JWT, 24h) + HTTP-only refresh tokens (7d)
- **In-memory + localStorage token management** with automatic refresh
- **React Query for data caching** with WebSocket-driven invalidation
- **Real-time cache synchronization** via WebSocket connections
- **User-scoped project selection** to prevent cross-account data leakage

---

## Architecture Overview

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

---

## Token Architecture

### Token Types

| Token Type     | Storage Location            | Lifetime | Purpose                    |
|----------------|----------------------------|----------|----------------------------|
| Access Token   | In-memory + localStorage   | 24 hours | API Authorization          |
| Refresh Token  | HTTP-only cookie           | 7 days   | Token refresh (XSS-immune) |

### Storage Locations

```javascript
// localStorage keys
localStorage.token                        // Access token (JWT)
localStorage.userId                       // User ID
localStorage.tokenExpiration              // Timestamp (Date.now() + 24h)
localStorage['selectedProjectId:{userId}'] // User-scoped project selection
localStorage.REACT_QUERY_OFFLINE_CACHE    // Persisted query cache

// In-memory (apiClient.ts)
accessToken  // Primary access token (security best practice)
```

---

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

---

## Key Flows

### Login Flow
```
User Input → authService.login() → Backend returns tokens →
storeAuthData() → AuthContext.login() → Navigate to /projects
```

### Token Refresh Flow
```
API returns 401 → Interceptor catches → refreshToken() →
Update tokens → Retry original request
```

### Cache Invalidation Flow
```
Backend change → PostgreSQL trigger → pg_notify →
WebSocket message → handleCacheInvalidation() →
queryClient.invalidateQueries() → UI updates
```

---

## Related Documentation

- [AUTH_FLOW.md](./AUTH_FLOW.md) - Detailed authentication flow documentation
- [CACHE_FLOW.md](./CACHE_FLOW.md) - Detailed caching system documentation
- [RISK_ANALYSIS.md](./RISK_ANALYSIS.md) - Risk areas and testing guidelines
- [FILE_REFERENCE.md](./FILE_REFERENCE.md) - Quick file reference map

---

## Critical Dependencies

| System    | Depends On                                                    |
|-----------|--------------------------------------------------------------|
| Auth      | localStorage, HTTP-only cookies, AuthContext, apiClient      |
| Cache     | React Query, WebSocket, Fresh JWT tokens, Project selection  |
| WebSocket | Valid access token, Project selection, Auth state            |

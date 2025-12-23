# DevHive React Frontend - Project Architecture

## Overview

DevHive React Frontend is a modern web application designed to empower agile teams through efficient communication and collaboration. Built with React 18 and TypeScript, it provides a comprehensive project management interface with real-time updates, task management, sprint planning, and team collaboration features.

## Tech Stack

### Core Framework
- **React**: 18.3.1 - Functional components with React Hooks
- **TypeScript**: 4.9.5 - Type safety and enhanced developer experience
- **React Router**: 7.0.2 - Client-side routing and navigation

### State Management & Data Fetching
- **React Query (TanStack Query)**: 5.62.11 - Server state management and caching
- **React Context API**: Global application state (Auth, Toast notifications)
- **localStorage Persistence**: Query cache persistence for offline support

### UI & Styling
- **Bootstrap**: 5.3.3 - CSS framework and components
- **React Bootstrap**: 2.10.6 - React components for Bootstrap
- **TailwindCSS**: Utility-first CSS (via custom styles)
- **Font Awesome**: 6.7.2 - Icon library

### API & Real-time Communication
- **Axios**: 1.7.9 - HTTP client for REST API calls
- **WebSocket**: Real-time cache invalidation and messaging
- **API Base URL**: `https://api.devhive.it.com/api/v1`

### Build Tools
- **Create React App**: 5.0.1 - Build tooling and development server
- **React Scripts**: 5.0.1 - Build scripts and configuration

## Project Structure

```
src/
├── components/          # Reusable React components
│   ├── AppContent.js    # Main routing and layout component
│   ├── Navbar.js        # Navigation component (sidebar/topbar)
│   ├── ProtectedRoute.tsx  # Route guard component
│   ├── LoginRegister.tsx    # Authentication UI
│   ├── Projects.tsx         # Project list view
│   ├── Board.tsx           # Kanban board component
│   ├── Backlog.tsx         # Sprint backlog view
│   └── ...                 # Other feature components
├── hooks/              # Custom React hooks
│   ├── useAuth.ts          # Authentication hook
│   ├── useProject.ts       # Project data hooks
│   ├── useSprints.ts       # Sprint data hooks
│   ├── useTasks.ts         # Task data hooks
│   ├── useRoutePermission.js  # Route access validation
│   └── ...                 # Other custom hooks
├── contexts/           # React Context providers
│   ├── AuthContext.tsx     # Authentication state management
│   └── ToastContext.tsx     # Toast notification system
├── services/           # API and business logic services
│   ├── authService.ts      # Authentication API calls
│   ├── projectService.js   # Project API calls
│   ├── taskService.js      # Task API calls
│   ├── messageService.js   # Messaging API calls
│   ├── cacheInvalidationService.ts  # WebSocket cache sync
│   └── ...                 # Other service modules
├── lib/                # Core library code
│   ├── apiClient.ts       # Axios instance with interceptors
│   └── queryClient.ts      # React Query configuration
├── config/              # Configuration files
│   ├── config.js          # API endpoints and base URLs
│   └── routeConfig.ts      # Route configuration
├── utils/               # Utility functions
│   ├── validation.ts      # Form validation utilities
│   ├── normalize.ts       # Data normalization
│   └── ...                # Other utilities
├── models/              # TypeScript type definitions
│   ├── user.ts            # User type definitions
│   ├── email.ts           # Email validation types
│   └── password.ts        # Password validation types
├── styles/               # CSS and styling files
│   ├── global.css         # Global styles
│   └── responsive.css     # Responsive design utilities
├── App.js                # Root application component
└── index.js              # Application entry point
```

## Core Architecture

### 1. Authentication System

The application uses a **dual-token authentication system**:

- **Access Token (JWT)**: Short-lived (15 minutes), stored in-memory and localStorage
- **Refresh Token**: Long-lived (7 days session or 30 days persistent/rememberMe), stored in HTTP-only cookies

**Key Components:**
- `AuthContext.tsx` - Central authentication state management
- `authService.ts` - Authentication API calls and token management
- `apiClient.ts` - Axios interceptors for automatic token refresh

**Flow:**
1. User logs in → receives access token + refresh token cookie
2. Access token included in API requests via Authorization header
3. On 401 response → automatic token refresh using refresh token
4. Failed refresh → user logged out and redirected to login

See [Authentication Architecture](./authentication_architecture.md) for detailed flow documentation.

### 2. State Management

**React Query** handles all server state:
- Automatic caching with configurable stale times
- Background refetching via WebSocket invalidation
- Optimistic updates for mutations
- localStorage persistence for offline support

**Context API** handles global UI state:
- `AuthContext` - Authentication status, user info, project selection
- `ToastContext` - Notification system for user feedback

**Local State** (useState/useReducer):
- Component-specific UI state
- Form state management
- Temporary UI interactions

See [Caching Strategy](./caching_strategy.md) for detailed caching documentation.

### 3. Real-time Updates

**WebSocket Connection** (`cacheInvalidationService.ts`):
- Maintains persistent connection to backend WebSocket server
- Receives cache invalidation messages on data changes
- Automatically invalidates React Query cache based on resource type
- Handles reconnection with exponential backoff

**Cache Invalidation Flow:**
1. Backend database change triggers PostgreSQL NOTIFY
2. Backend WebSocket broadcasts invalidation message
3. Frontend receives message and invalidates relevant queries
4. React Query refetches data for active components

See [Realtime Messaging](./realtime_messaging.md) for detailed WebSocket documentation.

### 4. Routing & Navigation

**Route Structure:**
- Public routes: `/`, `/forgot-password`, `/reset-password`
- Protected routes: `/projects`, `/board`, `/backlog`, `/sprint`, etc.
- Project-agnostic routes: `/projects`, `/create-project`, `/account-details`
- Project-scoped routes: `/board`, `/backlog`, `/sprint`, `/project-details`

**Route Protection:**
- `ProtectedRoute.tsx` - Wraps protected routes, checks authentication
- `useRoutePermission.js` - Validates project selection for project-scoped routes
- Automatic redirects to login or project selection when needed

**Navigation:**
- `Navbar.js` - Responsive navigation (sidebar on desktop, topbar on mobile)
- Dynamic visibility based on route and project selection
- Project selection stored in localStorage (user-scoped)

### 5. API Integration

**API Client** (`apiClient.ts`):
- Centralized Axios instance with base URL configuration
- Request interceptor: Adds Authorization header with access token
- Response interceptor: Handles 401 (token refresh) and 403 (forbidden) errors
- Automatic retry logic with exponential backoff

**Service Layer** (`services/`):
- Modular service files for each domain (auth, projects, tasks, etc.)
- Consistent error handling and response normalization
- TypeScript types for request/response payloads

**Error Handling:**
- RFC-7807 compliant error responses
- User-friendly error messages via Toast notifications
- Automatic cleanup on authentication failures

## Key Components

### App Structure

```
index.js
  └── QueryClientProvider
      └── AuthProvider
          └── ToastProvider
              └── BrowserRouter
                  └── App
                      └── AppContent
                          └── Routes
```

**Provider Order** (critical for stability):
1. QueryClientProvider - Must be outermost for React Query hooks
2. AuthProvider - Depends on QueryClient for auth queries
3. ToastProvider - Depends on AuthProvider for user context
4. BrowserRouter - Wrapped by all providers to prevent remounts

### Component Patterns

**Functional Components:**
- All components use functional components with hooks
- No class components in the codebase
- TypeScript for type safety where applicable

**Custom Hooks:**
- Data fetching hooks (`useProject`, `useSprints`, `useTasks`)
- Business logic hooks (`useBoardActions`, `useSprintManagement`)
- UI interaction hooks (`useKeyboardNavigation`, `useAutoResizeTextarea`)

**Lazy Loading:**
- Route components loaded lazily for code splitting
- `React.lazy()` and `Suspense` for optimal bundle size

## Data Flow

### Reading Data
1. Component calls custom hook (e.g., `useProjects()`)
2. Hook uses React Query `useQuery()` with query key
3. React Query checks cache → returns cached data if available
4. If stale/missing → makes API call via service layer
5. Response cached and returned to component
6. Component renders with data

### Writing Data
1. Component calls mutation hook (e.g., `useCreateProject()`)
2. Hook uses React Query `useMutation()`
3. Mutation function calls service layer API
4. On success → invalidates related queries
5. React Query refetches invalidated queries
6. UI updates with fresh data

### Real-time Updates
1. Backend change triggers WebSocket message
2. `cacheInvalidationService` receives message
3. Service invalidates relevant React Query cache
4. Active components automatically refetch
5. UI updates with latest data

## Security Considerations

### Token Management
- Access tokens stored in-memory (primary) + localStorage (fallback)
- Refresh tokens in HTTP-only cookies (XSS-immune)
- Automatic token refresh before expiration
- Token cleanup on logout and auth failures

### Route Protection
- Protected routes require authentication
- Project-scoped routes require project selection
- Automatic redirects for unauthorized access
- Session persistence across page reloads

### Data Isolation
- Project selection scoped to user ID
- localStorage keys prefixed with user ID
- WebSocket connections scoped to selected project
- Cache invalidation respects project boundaries

## Performance Optimizations

### Code Splitting
- Route-based code splitting with lazy loading
- Dynamic imports for large components
- Reduced initial bundle size

### Caching Strategy
- Aggressive caching with WebSocket invalidation
- localStorage persistence for offline support
- Optimistic updates for better UX

### Rendering Optimizations
- React.memo() for expensive components
- useMemo/useCallback for expensive computations
- Debounced search and input handlers

## Development Workflow

### Environment Setup
- Node.js and npm required
- Environment variables in `.env` file
- See [Environment Setup](../SOP/environment_setup.md) for details

### Development Server
```bash
npm start  # Starts development server on http://localhost:3000
```

### Building for Production
```bash
npm run build  # Creates optimized production build in /build
```

### Testing
```bash
npm test  # Runs test suite
```

## Related Documentation

- [Authentication Architecture](./authentication_architecture.md) - Detailed auth flows and token management
- [Caching Strategy](./caching_strategy.md) - React Query configuration and cache invalidation
- [Realtime Messaging](./realtime_messaging.md) - WebSocket implementation and messaging system
- [Invite Management](./invite_management.md) - Project invite system
- [File Reference](./file_reference.md) - Quick reference for key files and line numbers
- [Risk Analysis](./risk_analysis.md) - Risk areas and testing guidelines
- [Environment Setup](../SOP/environment_setup.md) - Development environment configuration
- [Development Workflow](../SOP/development_workflow.md) - Common development procedures
- [Migration Guide](../SOP/migration_guide.md) - Backend migration documentation


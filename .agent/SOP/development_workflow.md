# Development Workflow - DevHive React Frontend

## Overview

This document outlines standard operating procedures for common development tasks in the DevHive React Frontend project.

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git

### Initial Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file (see [Environment Setup](./environment_setup.md))
4. Start development server: `npm start`

## Common Development Tasks

### Adding a New Component

1. **Create component file** in `src/components/`
   - Use PascalCase for component names
   - Use TypeScript (`.tsx`) for new components
   - Include proper TypeScript types for props

2. **Follow component structure:**
```typescript
import React from 'react';

interface ComponentNameProps {
  // Define props here
}

const ComponentName: React.FC<ComponentNameProps> = ({ prop1, prop2 }) => {
  // Component logic
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};

export default ComponentName;
```

3. **Add component to appropriate route** in `src/components/AppContent.js`

### Adding a New Hook

1. **Create hook file** in `src/hooks/`
   - Use camelCase with `use` prefix (e.g., `useCustomHook.ts`)
   - Use TypeScript for type safety

2. **Follow hook structure:**
```typescript
import { useState, useEffect } from 'react';

export const useCustomHook = (param: string) => {
  const [state, setState] = useState<string>('');
  
  useEffect(() => {
    // Hook logic
  }, [param]);
  
  return { state };
};
```

### Adding a New API Service

1. **Create service file** in `src/services/`
   - Use camelCase with `Service` suffix (e.g., `customService.ts`)
   - Import `api` from `src/lib/apiClient.ts`

2. **Follow service structure:**
```typescript
import { api } from '../lib/apiClient';
import { ENDPOINTS } from '../config';

export const fetchCustomData = async (id: string) => {
  try {
    const response = await api.get(`${ENDPOINTS.CUSTOM}/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching custom data:', error);
    throw error;
  }
};
```

3. **Add endpoint** to `src/config.js` if needed

### Adding a New Route

1. **Create route component** (see "Adding a New Component")

2. **Add route** to `src/components/AppContent.js`:
```typescript
import CustomPage from './CustomPage';

// In Routes:
<Route path="/custom" element={<ProtectedRoute><CustomPage /></ProtectedRoute>} />
```

3. **Update route config** in `src/config/routeConfig.ts` if it's project-scoped

4. **Add navigation link** in `src/components/Navbar.js` if needed

### Working with React Query

1. **Create query hook** in `src/hooks/`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchCustomData } from '../services/customService';

export const useCustomData = (id: string) => {
  return useQuery({
    queryKey: ['custom', id],
    queryFn: () => fetchCustomData(id),
    enabled: !!id, // Only fetch if id exists
  });
};
```

2. **Create mutation hook** for data updates:
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCustomData } from '../services/customService';

export const useUpdateCustomData = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateCustomData,
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries(['custom', variables.id]);
    },
  });
};
```

### Working with Authentication

1. **Use `useAuth` hook** for auth state:
```typescript
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { isAuthenticated, user, selectedProject } = useAuth();
  // Use auth state
};
```

2. **Protect routes** with `ProtectedRoute`:
```typescript
<Route path="/protected" element={<ProtectedRoute><ProtectedPage /></ProtectedRoute>} />
```

### Working with WebSocket Cache Invalidation

1. **WebSocket connection** is handled automatically by `AuthContext`
2. **Cache invalidation** happens automatically via `cacheInvalidationService`
3. **Query keys** must follow the pattern used in `cacheInvalidationService.ts`

### Styling Guidelines

1. **Use TailwindCSS utility classes** for styling
2. **Use responsive classes** (see [Responsive Design Guide](./responsive_design.md))
3. **Follow mobile-first approach**
4. **Use semantic HTML elements**

## Code Quality Standards

### TypeScript
- Use TypeScript for all new files
- Define proper types/interfaces for props and state
- Avoid `any` type - use proper types or `unknown`

### Naming Conventions
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useUserData.ts`)
- **Services**: camelCase with `Service` suffix (e.g., `userService.ts`)
- **Utils**: camelCase (e.g., `formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS`)

### File Organization
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Keep service functions pure and testable
- Group related utilities together

### Error Handling
- Use try-catch blocks for async operations
- Provide user-friendly error messages via Toast
- Log errors to console for debugging
- Handle edge cases gracefully

## Testing

### Manual Testing Checklist
- [ ] Test on different screen sizes (mobile, tablet, desktop)
- [ ] Test authentication flows (login, logout, token refresh)
- [ ] Test protected routes
- [ ] Test WebSocket reconnection
- [ ] Test cache invalidation
- [ ] Test error handling

### Browser Testing
- Test in Chrome, Firefox, Safari, Edge
- Test on mobile devices (iOS and Android)
- Test responsive breakpoints

## Debugging

### Common Issues

1. **Token refresh loops**
   - Check `apiClient.ts` interceptors
   - Verify auth route detection

2. **WebSocket connection failures**
   - Check token expiration
   - Verify project selection
   - Check network connectivity

3. **Cache not updating**
   - Verify WebSocket connection
   - Check query keys match invalidation patterns
   - Verify cache invalidation messages received

### Debug Tools
- React Query DevTools (in development)
- Browser DevTools (Network, Application tabs)
- Console logging (use sparingly in production)

## Git Workflow

### Branch Naming
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `refactor/component-name` - Code refactoring
- `docs/documentation-update` - Documentation updates

### Commit Messages
- Use clear, descriptive messages
- Reference issue numbers if applicable
- Follow conventional commit format when possible

## Deployment

### Build Process
1. Run `npm run build` to create production build
2. Test production build locally
3. Deploy to hosting platform

### Environment Variables
- Ensure all required environment variables are set
- Use different values for development and production
- Never commit sensitive values to repository

## Related Documentation

- [Project Architecture](../System/project_architecture.md) - Overall system architecture
- [Environment Setup](./environment_setup.md) - Development environment configuration
- [Authentication Architecture](../System/authentication_architecture.md) - Auth system details
- [Caching Strategy](../System/caching_strategy.md) - Cache system details
- [Risk Analysis](../System/risk_analysis.md) - Risk areas and testing guidelines


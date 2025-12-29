# Error Handling - Standard Operating Procedures

## Overview

This document describes error handling best practices and patterns for the DevHive React Frontend, with specific focus on authentication errors, API errors, and WebSocket failures.

**Latest Update (2025-12-28)**: Auth error-handling fixes and WebSocket fallback mechanisms.

---

## 1. Authentication Error Handling

### 1.1 Axios Interceptor - 401 Error Handling

**File:** `src/lib/api.ts:43-72`

**Critical Rule:** Never redirect users on 401 errors from auth endpoints (login, register, password reset, refresh).

#### Implementation

```javascript
// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const problem = error.response?.data;
    const message = problem?.detail || problem?.title || error.message;

    // Only redirect on 401 if it's NOT an auth endpoint
    if (error.response?.status === 401) {
      const isAuthEndpoint =
        error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/register') ||
        error.config?.url?.includes('/auth/password/reset-request') ||
        error.config?.url?.includes('/auth/password/reset') ||
        error.config?.url?.includes('/auth/refresh') ||
        (error.config?.method === 'post' && error.config?.url?.endsWith('/users'));

      if (!isAuthEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        window.location.href = '/';
      }
    }

    const normalizedError = new Error(message) as any;
    normalizedError.status = error.response?.status;
    normalizedError.originalError = error;
    return Promise.reject(normalizedError);
  }
);
```

**Why This Matters:**
- ❌ **Before:** Wrong username/password resulted in redirect to login page (user already on login page)
- ✅ **After:** Wrong credentials show error message, user can retry

#### Auth Endpoint Allowlist

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | User login |
| `/auth/register` | POST | User registration |
| `/auth/password/reset-request` | POST | Request password reset |
| `/auth/password/reset` | POST | Complete password reset |
| `/auth/refresh` | POST | Refresh access token |
| `/users` (exact match) | POST | User creation (registration) |

### 1.2 UI Error Message Extraction

**File:** `src/hooks/useLoginRegisterNew.ts:227-254`

**Critical Rule:** Always prefer backend error messages (`detail`, `title`, `message`) over generic Axios error messages.

#### Implementation

```javascript
try {
  // ... authentication logic
} catch (err: any) {
  // Extract error message - prefer backend detail/title over generic err.message
  let errorMessage = '❌ An error occurred. Please try again.';

  const data = err?.response?.data;
  if (data?.detail || data?.title || data?.message) {
    // Prefer backend error messages (detail, title, or message)
    errorMessage = data.detail || data.title || data.message;
  } else if (typeof err?.message === 'string' && err.message.trim()) {
    // Fall back to err.message only if backend data is unavailable
    errorMessage = err.message;
  } else if (typeof err === 'string') {
    errorMessage = err;
  }

  // For 401 errors without a good detail, provide a more helpful message
  if (err?.response?.status === 401 && !data?.detail && !data?.title) {
    errorMessage = 'Incorrect username or password.';
  }

  updateState({
    error: errorMessage,
    success: false,
    successType: null
  });
}
```

**Message Priority (from highest to lowest):**

1. `err?.response?.data?.detail` - Backend-specific error (best)
2. `err?.response?.data?.title` - Backend error title
3. `err?.response?.data?.message` - Backend error message
4. `err?.message` - Axios error message (generic, least helpful)
5. Default fallback: "An error occurred. Please try again."

**Special Cases:**

| Status Code | Condition | Message |
|-------------|-----------|---------|
| 401 | No backend detail/title | "Incorrect username or password." |

**Why This Matters:**
- ❌ **Before:** Users saw "Request failed with status code 401" (unhelpful)
- ✅ **After:** Users see "Incorrect username or password." or backend-specific errors

---

## 2. WebSocket Error Handling

### 2.1 Message Cache Invalidation with Fallback

**Problem:** Messages query uses `staleTime: Infinity`, so if WebSocket invalidation fails (missing projectId, connection dropped, etc.), messages never update.

**Solution:** Add fallback refetch on send success while maintaining WebSocket as primary invalidation mechanism.

#### Implementation

**File:** `src/hooks/useMessages.ts:60-77`

```javascript
export const useSendMessage = () => {
  const queryClient = useQueryClient();
  const { userId } = useAuthContext();

  return useMutation({
    mutationFn: (messageData: { projectId: string; content: string; messageType?: string; parentMessageId?: string }) =>
      sendMessage(messageData),
    // Fallback: refetch on success to ensure messages update even if WebSocket invalidation fails
    onSuccess: (data, variables) => {
      const { projectId } = variables;
      // Refetch the messages query for this project/user
      queryClient.refetchQueries({
        queryKey: messageKeys.project(projectId, userId),
        exact: true,
      });
    },
  });
};
```

**Why This Matters:**
- ✅ **Primary path:** WebSocket broadcasts `message_created` → cache invalidates → messages refetch
- ✅ **Fallback path:** Send mutation succeeds → manually refetch → messages update
- ✅ **Result:** Messages always update, even if WebSocket fails

### 2.2 ProjectId Extraction from WebSocket Events

**Problem:** WebSocket events may send projectId in different formats (camelCase, snake_case, nested in data, etc.), causing invalidation to fail.

**Solution:** Extract projectId from multiple sources with proper fallbacks.

#### Implementation

**File:** `src/services/cacheInvalidationService.ts:610-628`

```javascript
case 'message_created': {
  // Extract projectId from multiple sources (top-level, data, subscribed project)
  const projectId =
    message.projectId ||
    message.project_id ||
    (message.data as any)?.projectId ||
    (message.data as any)?.project_id ||
    this.currentProjectId ||
    '';

  if (!projectId) {
    console.warn('⚠️ message_created missing projectId; keys:', Object.keys(message), 'dataKeys:', Object.keys(message.data || {}));
    return;
  }

  console.log(`💬 Message created for project ${projectId}`);
  this.invalidateProjectMessages(projectId);
  break;
}
```

**ProjectId Source Priority:**

1. `message.projectId` - Top-level camelCase (preferred)
2. `message.project_id` - Top-level snake_case (legacy)
3. `message.data?.projectId` - Nested camelCase
4. `message.data?.project_id` - Nested snake_case
5. `this.currentProjectId` - Fallback to subscribed project
6. Empty string (triggers warning and bails)

**Why This Matters:**
- ✅ Handles backend format changes gracefully
- ✅ Survives deploy transitions where payload shapes might differ
- ✅ Logs warnings for debugging when projectId is missing

### 2.3 Empty ProjectId Safety Check

**File:** `src/services/cacheInvalidationService.ts:455-476`

```javascript
private invalidateProjectMessages(projectId: string): void {
  // Bail if projectId is empty (don't invalidate a blank key)
  if (!projectId || projectId === '') {
    console.warn('⚠️ Attempted to invalidate messages with empty projectId - skipping');
    return;
  }

  console.log(`🔄 Invalidating message queries for project: ${projectId}`);
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
    refetchType: 'active',
  });
}
```

**Why This Matters:**
- ❌ **Before:** `invalidating message queries for project: ` (blank projectId, no queries match)
- ✅ **After:** Logs warning and bails, preventing invalid invalidation attempts

---

## 3. API Error Handling Best Practices

### 3.1 Error Message Extraction Pattern

**Rule:** Always extract error messages in this order:

```javascript
let errorMessage = 'Default fallback message';

const data = err?.response?.data;
if (data?.detail || data?.title || data?.message) {
  // Prefer backend error messages
  errorMessage = data.detail || data.title || data.message;
} else if (typeof err?.message === 'string' && err.message.trim()) {
  // Fall back to err.message only if backend data is unavailable
  errorMessage = err.message;
} else if (typeof err === 'string') {
  errorMessage = err;
}

// Add status-specific overrides if needed
if (err?.response?.status === 401 && !data?.detail && !data?.title) {
  errorMessage = 'Specific 401 message';
}
```

### 3.2 HTTP Status Code Handling

| Status | Meaning | Handling |
|--------|---------|----------|
| 400 | Bad Request | Show backend error message |
| 401 | Unauthorized | Check if auth endpoint; show "Incorrect credentials" if no backend detail |
| 403 | Forbidden | Show backend error message |
| 404 | Not Found | Show backend error message |
| 500 | Server Error | Show generic error, log details |
| Network Error | No response | Show "Network error. Please check your connection." |

### 3.3 Error Logging

**Development:**
```javascript
console.error('❌ Error context:', error);
console.error('📊 Error details:', {
  status: error?.response?.status,
  data: error?.response?.data,
  message: error?.message
});
```

**Production:**
- Use error reporting service (e.g., Sentry)
- Log errors to monitoring system
- Never expose sensitive data in error messages

---

## 4. Build Version Tracking

### 4.1 Build Information Logging

**File:** `src/buildInfo.ts`

**Purpose:** Track which frontend version is running in production to debug version mismatch issues.

#### Implementation

```typescript
// Version from package.json
export const VERSION = '0.1.0';

// Build timestamp
export const BUILD_TIMESTAMP = new Date().toISOString();

// Unique build ID
export const BUILD_ID = `${VERSION}`;

export function logBuildInfo(): void {
  console.log(`
╔════════════════════════════════════════╗
║         DevHive Frontend Build         ║
╠════════════════════════════════════════╣
║ Version:    ${VERSION.padEnd(27)}║
║ Build ID:   ${BUILD_ID.padEnd(27)}║
║ Timestamp:  ${BUILD_TIMESTAMP.substring(0, 19).padEnd(27)}║
╚════════════════════════════════════════╝
  `);
}
```

**Initialization:** `src/index.js:14-17`

```javascript
import { logBuildInfo } from './buildInfo.ts';

// Log build info at startup for version tracking
logBuildInfo();
```

**Why This Matters:**
- ✅ Instantly identify which version is running in browser dev tools
- ✅ Debug "it works in one browser but not another" issues
- ✅ Confirm both users are on same version during testing

---

## 5. Common Error Scenarios

### Scenario 1: Wrong Username/Password

**Flow:**
1. User enters wrong credentials
2. Backend returns 401 with `{ detail: "Invalid credentials" }`
3. Axios interceptor sees 401 on `/auth/login` → skips redirect
4. Error handler extracts `detail` → shows "Invalid credentials"
5. User sees error message, can retry

### Scenario 2: WebSocket Message Invalidation Fails

**Flow:**
1. User sends message
2. Backend creates message, broadcasts `message_created` event
3. WebSocket event arrives but projectId is missing/empty
4. `cacheInvalidationService` logs warning, bails on invalidation
5. **Fallback:** `useSendMessage.onSuccess` refetches messages query
6. Messages list updates with new message

### Scenario 3: Version Mismatch Between Browsers

**Flow:**
1. Developer opens browser A → sees build banner with version
2. Developer deploys new version
3. Developer opens browser B → sees build banner with different version
4. Developer knows they're running different versions → clears cache / hard refresh

---

## 6. Testing Error Handling

### Test Cases

#### Auth Errors
- [ ] Wrong username/password → shows error message, no redirect
- [ ] Expired refresh token → redirects to login
- [ ] Network error during login → shows network error message
- [ ] Server error (500) during login → shows generic error message

#### WebSocket Errors
- [ ] Message sent with WebSocket connected → message appears via WebSocket
- [ ] Message sent with WebSocket disconnected → message appears via fallback refetch
- [ ] WebSocket event with missing projectId → warning logged, fallback refetch works

#### Version Tracking
- [ ] Open browser → build info appears in console
- [ ] Deploy new version → different build ID in console

---

## Related Documentation

- [Authentication Architecture](../System/authentication_architecture.md) - Complete auth flows and token management
- [Caching Strategy](../System/caching_strategy.md) - React Query configuration and cache invalidation
- [Realtime Messaging](../System/realtime_messaging.md) - WebSocket implementation and message flow
- [Development Workflow](./development_workflow.md) - Common development tasks
- [Risk Analysis](../System/risk_analysis.md) - Critical areas and testing guidelines

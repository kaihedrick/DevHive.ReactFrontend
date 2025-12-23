import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, ENDPOINTS } from '../config';

// Token expiration tracking
const TOKEN_EXPIRATION_KEY = 'tokenExpiration';
const TOKEN_VALIDITY_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds (fallback)

// In-memory storage for access token (not localStorage for security)
let accessToken: string | null = null;
let isRefreshing = false;
let authInitializationPromise: Promise<string | null> | null = null; // Track initialization refresh
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

/**
 * Check if a token refresh is currently in progress
 * Used by AuthContext to coordinate with response interceptor
 */
export const getIsRefreshing = (): boolean => isRefreshing;

/**
 * Set the refreshing state
 * Called by AuthContext during initialization refresh
 */
export const setIsRefreshing = (value: boolean): void => {
  isRefreshing = value;
};

/**
 * Set the auth initialization promise
 * This allows the response interceptor to wait for initialization refresh
 */
export const setAuthInitializationPromise = (promise: Promise<string | null> | null): void => {
  authInitializationPromise = promise;
};

/**
 * Get the current auth initialization promise
 * Used by response interceptor to wait for initialization if in progress
 */
export const getAuthInitializationPromise = (): Promise<string | null> | null => {
  return authInitializationPromise;
};

/**
 * Parse JWT Expiration
 * 
 * Extracts the actual expiration time from the JWT 'exp' claim.
 * This ensures we use the backend's actual token expiration instead of
 * a frontend-calculated timestamp.
 * 
 * Related Documentation:
 * - .agent/Tasks/fix_authentication_15min_logout.md - Fix 2: Use JWT expiration
 */
export const parseJWTExpiration = (token: string): number | null => {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('⚠️ Invalid JWT format - expected 3 parts');
      return null;
    }
    
    // Decode base64url payload
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    
    // Decode and parse JSON
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    
    // JWT exp is in seconds, convert to milliseconds
    if (payload.exp && typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ Failed to parse JWT expiration:', error);
    return null;
  }
};

// Helper to process queued requests after token refresh
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important for HttpOnly refresh token cookies
});

// Get access token from memory
export const getAccessToken = (): string | null => accessToken;

/**
 * Check if token is expired
 *
 * Uses a 30-second buffer to prevent race conditions where the token
 * expires between the check and the actual API request.
 *
 * Related Documentation:
 * - .agent/Tasks/fix_authentication_15min_logout.md - Fix 3: Add buffer time
 */
export const isTokenExpired = (): boolean => {
  const expirationTimestamp = localStorage.getItem(TOKEN_EXPIRATION_KEY);
  const hasToken = !!localStorage.getItem('token');

  if (!expirationTimestamp) {
    // No expiration timestamp - consider expired if token exists (legacy token)
    console.log('🔍 isTokenExpired: No expiration timestamp, hasToken:', hasToken);
    return hasToken;
  }

  const expirationTime = parseInt(expirationTimestamp, 10);
  const now = Date.now();
  const buffer = 30 * 1000; // 30 seconds buffer to prevent race conditions
  const isExpired = (now + buffer) > expirationTime;

  // Debug logging for token expiration check
  const ttlSeconds = Math.round((expirationTime - now) / 1000);
  const ttlMinutes = Math.round(ttlSeconds / 60);
  console.log('🔍 isTokenExpired:', {
    isExpired,
    ttlSeconds,
    ttlMinutes,
    expirationTime: new Date(expirationTime).toISOString(),
    now: new Date(now).toISOString()
  });

  // Token is expired if current time + buffer is past expiration time
  return isExpired;
};

// Check if token is expired beyond validity window (used for cleanup/validation)
export const isTokenExpiredBeyondWindow = (): boolean => {
  const expirationTimestamp = localStorage.getItem(TOKEN_EXPIRATION_KEY);
  if (!expirationTimestamp) {
    return true; // No expiration timestamp means token is invalid
  }
  
  const expirationTime = parseInt(expirationTimestamp, 10);
  const now = Date.now();
  const windowEnd = expirationTime + TOKEN_VALIDITY_DURATION;
  
  // Token is expired beyond validity window if current time is past window end
  return now > windowEnd;
};

/**
 * Set access token in memory and localStorage
 * 
 * Uses actual JWT expiration from the token's 'exp' claim instead of
 * frontend-calculated timestamp. This ensures we respect the backend's
 * actual token expiration time.
 * 
 * Related Documentation:
 * - .agent/Tasks/fix_authentication_15min_logout.md - Fix 2: Use JWT expiration
 */
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  // Also update localStorage for backward compatibility during migration
  if (token) {
    localStorage.setItem('token', token);
    
    // Use actual JWT expiration instead of frontend-calculated timestamp
    const jwtExpiration = parseJWTExpiration(token);
    if (jwtExpiration) {
      localStorage.setItem(TOKEN_EXPIRATION_KEY, jwtExpiration.toString());
      
      // Debug logging to diagnose expiration issues
      const ttlMinutes = Math.round((jwtExpiration - Date.now()) / 1000 / 60);
      const expirationDate = new Date(jwtExpiration).toISOString();
      console.log('🔑 Token stored with expiration:', expirationDate, 'TTL:', ttlMinutes, 'minutes');
      
      // Warn if token expiration differs significantly from expected 15 minutes
      const expectedTTL = 15; // 15 minutes
      if (Math.abs(ttlMinutes - expectedTTL) > 5) {
        console.warn('⚠️ Token expiration differs from expected 15 minutes:', ttlMinutes, 'minutes');
      }
    } else {
      // Fallback to 15 minutes if JWT parsing fails
      const expirationTime = Date.now() + TOKEN_VALIDITY_DURATION;
      localStorage.setItem(TOKEN_EXPIRATION_KEY, expirationTime.toString());
      console.warn('⚠️ Failed to parse JWT expiration, using 15-minute fallback');
    }
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem(TOKEN_EXPIRATION_KEY);
  }
};

// Clear access token
export const clearAccessToken = (): void => {
  accessToken = null;
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem(TOKEN_EXPIRATION_KEY);
};

/**
 * Refresh token function
 *
 * Calls POST /api/v1/auth/refresh with no body - refresh token is in httpOnly cookie
 * Returns new access token: { "token": "...", "userID": "..." }
 * Note: Uses axios directly (not api instance) to avoid interceptor loops
 *
 * Includes retry logic for transient failures (network errors, temporary cookie attachment issues)
 *
 * @param retryCount - Internal parameter for retry logic (default 0)
 */
export const refreshToken = async (retryCount: number = 0): Promise<string | null> => {
  const MAX_RETRIES = 3; // Retry up to 3 times for transient network errors
  const RETRY_DELAY = 150; // Wait 150ms before retry (exponential backoff)

  // Log attempt for debugging
  if (retryCount === 0) {
    console.log('🔄 Starting token refresh (attempt 1)');
  }

  try {
    // Use axios directly to avoid interceptor loops (refresh endpoint is auth route)
    // This bypasses the api instance interceptors
    // ENDPOINTS.AUTH_REFRESH already includes the full URL
    const response = await axios.post(
      ENDPOINTS.AUTH_REFRESH,
      {}, // No body needed - refresh token is in httpOnly cookie
      {
        withCredentials: true, // CRITICAL: Required to send refresh_token cookie
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Backend returns: { "token": "...", "userID": "..." }
    const { token, Token, userID, userId } = response.data;
    const newToken = token || Token;
    const newUserId = userID || userId;

    if (newToken) {
      setAccessToken(newToken);
      if (newUserId) {
        localStorage.setItem('userId', newUserId);
      }
      if (retryCount > 0) {
        console.log(`✅ Token refresh succeeded on retry ${retryCount}`);
      }
      return newToken;
    }

    throw new Error('Refresh token response missing token');
  } catch (error) {
    const status = (error as any)?.response?.status;
    const is401 = status === 401;

    // Log the error for debugging
    console.log(`❌ Refresh token failed on attempt ${retryCount + 1}:`, {
      status,
      is401,
      message: (error as any)?.message,
      retryCount
    });

    // Retry logic for transient failures:
    // - Network errors (status undefined): Retry up to MAX_RETRIES with exponential backoff
    // - 401 errors: Retry once (could be transient cookie attachment issue on any browser)
    //   If 401 persists after retry, the refresh token is legitimately expired
    const isNetworkError = status === undefined;
    const shouldRetry401 = is401 && retryCount === 0; // Only retry 401 once (first attempt only)
    const shouldRetryNetwork = isNetworkError && retryCount < MAX_RETRIES; // Retry network errors up to MAX_RETRIES
    const shouldRetry = shouldRetry401 || shouldRetryNetwork;

    if (shouldRetry) {
      // Exponential backoff: 150ms, 300ms, 600ms for network errors
      // For 401 errors, use 150ms delay (single retry for transient failures)
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      const retryType = is401 ? 'transient failure' : 'network error';
      const maxAttempts = is401 ? 2 : MAX_RETRIES + 1; // 401 gets 2 attempts total, network errors get MAX_RETRIES + 1
      console.log(`⏳ Refresh token retry ${retryCount + 2}/${maxAttempts} in ${delay}ms (${retryType})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return refreshToken(retryCount + 1);
    }

    // CRITICAL: Only clear tokens on 401 after retries exhausted
    // For 401 errors: Retry once (transient failure), then clear if still 401
    // Network errors, 500s, timeouts should NOT clear tokens
    // The refresh token cookie might still be valid - let the user retry
    if (is401) {
      if (retryCount === 0) {
        // This shouldn't happen - we should have retried once already
        console.log('⚠️ Refresh token expired (401 on first attempt, retry skipped), clearing auth');
      } else {
        console.log(`⚠️ Refresh token expired (401 after ${retryCount + 1} attempt(s)), clearing auth`);
      }
      clearAccessToken();
    } else {
      console.warn('⚠️ Refresh failed with non-401 error, keeping tokens for retry:', error);
    }
    throw error;
  }
};

// Auth routes that must NEVER have auth headers or refresh logic applied
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/password/reset-request',
  '/auth/password/reset',
];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/users/validate-email',
  '/users/validate-username',
];

// Helper to check if a URL is an auth route that should skip token refresh/interception
// Handles both full URLs (https://...) and relative paths (/auth/...)
const isAuthRoute = (url: string | undefined): boolean => {
  if (!url) return false;
  
  // Check for auth routes (works with both full URLs and relative paths)
  const isAuthEndpoint = AUTH_ROUTES.some(route => url.includes(route));
  if (isAuthEndpoint) return true;
  
  // Check for registration endpoint (POST /users without /users/ in path)
  if (url.endsWith('/users') && !url.includes('/users/')) {
    return true;
  }
  
  return false;
};

// Helper to check if a URL is a public route that doesn't require auth
const isPublicRoute = (url: string | undefined): boolean => {
  if (!url) return false;
  return PUBLIC_ROUTES.some(route => url.includes(route));
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // CRITICAL: Auth routes and public routes must NEVER have auth headers or token checks
    // These routes are unauthenticated by design:
    // - /auth/login, /auth/register, /auth/refresh, /auth/logout
    // - /auth/password/reset-request, /auth/password/reset
    // - POST /users (registration)
    // - /users/validate-email, /users/validate-username (public validation)
    // For these routes, return config immediately without any auth logic
    if (isAuthRoute(config.url) || isPublicRoute(config.url)) {
      return config; // Skip ALL auth handling - no token, no expiration check, nothing
    }
    
    // For non-auth routes, attach token if available
    // NOTE: We do NOT check token age here. Even if the access token is old,
    // the refresh token might still be valid (valid for 7 days). Let the backend
    // tell us if refresh is needed via 401 responses, which will trigger the
    // refresh flow in the response interceptor.
    const token = getAccessToken() || localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      // Initialize in-memory token if it exists in localStorage
      if (!accessToken) {
        accessToken = token;
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // CRITICAL: Auth routes and public routes must NEVER trigger refresh or clear auth state
    // 401s on auth routes are expected (wrong credentials, etc.) and should pass through
    // Do NOT attempt refresh, do NOT clear auth state, do NOT treat as token expiration
    if (isAuthRoute(originalRequest?.url) || isPublicRoute(originalRequest?.url)) {
      // For auth/public routes, return the original error directly - no special handling
      return Promise.reject(error);
    }
    
    // Handle 401 errors with refresh token flow
    // Only attempt refresh if:
    // 1. Request is not an auth/public route (already checked above)
    // 2. Error is 401 (Unauthorized)
    // 3. Request hasn't been retried yet
    // 4. We have a refresh token (userId exists) - if no token, just return 401
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // CRITICAL: Only attempt refresh if we have a userId (user was logged in)
      // If no userId, this is an unauthenticated request - just return the 401
      const hasUserId = !!localStorage.getItem('userId');
      if (!hasUserId) {
        // No user ID means user is not authenticated - don't attempt refresh
        // Just return the original 401 error
        return Promise.reject(error);
      }

      // CRITICAL: Check if auth initialization is in progress
      // If so, wait for it to complete instead of starting a new refresh
      // This prevents race conditions during app startup
      const initPromise = authInitializationPromise;
      if (initPromise) {
        console.log('🔄 401 received, waiting for initialization refresh to complete...');
        try {
          const token = await initPromise;
          if (token && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        } catch (initError) {
          // Initialization refresh failed - return original error
          console.log('⚠️ Initialization refresh failed, returning original 401');
          return Promise.reject(error);
        }
      }

      // Check if we're already refreshing
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      // Mark request as retried and start refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint (uses refresh_token cookie automatically)
        const newToken = await refreshToken();
        
        // Process queued requests with new token
        processQueue(null, newToken);
        
        // Update original request with new token
        if (originalRequest.headers && newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        
        // Retry original request with new token
        return api(originalRequest);
      } catch (refreshError: any) {
        // Refresh failed - check if it's a 401 (refresh token expired) or other error
        processQueue(refreshError, null);

        // CRITICAL: Only clear tokens and trigger logout on 401
        // Network errors, 500s, timeouts should NOT trigger logout
        // The refresh token cookie might still be valid - let the user retry
        const is401 = refreshError?.response?.status === 401;

        if (is401) {
          // Refresh token expired (7 days passed) or invalidated
          // This is a real authentication failure - clear tokens and trigger logout
          console.log('⚠️ Refresh token expired (401), triggering logout');

          // Clear auth state - removes tokens from memory and localStorage
          clearAccessToken();

          /**
           * Dispatch 'auth-state-changed' Event
           *
           * This event notifies AuthContext that tokens have been cleared due to refresh token expiration.
           *
           * Event Flow:
           * 1. This interceptor clears tokens and dispatches event
           * 2. AuthContext.handleAuthStateChange() listens for this event
           * 3. Handler detects tokens cleared, sets explicitLogoutRef.current = true
           * 4. Handler sets isAuthenticated = false
           * 5. WebSocket effect detects explicitLogoutRef and disconnects WebSocket
           *
           * Why dispatch event instead of calling logout() directly?
           * - Keeps separation of concerns (apiClient doesn't know about AuthContext)
           * - Allows other components to listen for auth state changes
           * - Enables cross-tab synchronization via storage events
           *
           * CRITICAL: Do NOT redirect here - let AuthContext handle navigation
           * Redirecting causes page remount which loses console logs and breaks debugging
           * AuthContext will handle navigation through ProtectedRoute components
           *
           * Related Documentation:
           * - .agent/System/authentication_architecture.md - Token refresh flow (section 2)
           * - .agent/System/authentication_architecture.md - Auth state change handler (section 6)
           * - src/contexts/AuthContext.tsx - handleAuthStateChange() function
           */
          window.dispatchEvent(new Event('auth-state-changed'));

          // DO NOT redirect here - causes remounting and loses console logs
          // Let AuthContext and ProtectedRoute handle navigation naturally
          // This preserves console logs for debugging logout issues
        } else {
          // Network error, timeout, 500, etc - NOT a token expiration
          // Keep tokens and auth state - refresh token might still be valid
          // User can retry when network/server recovers
          console.warn('⚠️ Refresh failed with non-401 error, keeping tokens for retry:', refreshError);
        }

        // Return the original 401 error with all its properties preserved
        // This ensures url, status, response, config are all maintained
        // The calling code can handle the error appropriately
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    
    // If we get here, the error is not a 401 or refresh was not attempted
    // Return the original error to preserve all its properties

    // Handle 403 errors for project access (user was removed from project)
    // BUT: Skip this for auth routes (login/register) - those 403s are "Invalid credentials"
    if (error.response?.status === 403) {
      const url = originalRequest?.url || error.config?.url || error.request?.responseURL || '';
      
      // Don't treat 403 from auth routes as project access errors
      // Auth route 403s should be treated as "Invalid credentials" and fall through to error normalization
      if (isAuthRoute(url) || isPublicRoute(url)) {
        // Let it fall through to error normalization below
        // The backend should return "Invalid credentials" in the error detail
      } else {
        // Only handle project access 403s for non-auth routes
        const projectIdMatch = url.match(/\/projects\/([^/]+)/);
        
        if (projectIdMatch && projectIdMatch[1]) {
          const projectId = projectIdMatch[1];
          const currentUserId = localStorage.getItem('userId');
          
          // Only handle if we have a userId (user is logged in)
          if (currentUserId) {
            // Import queryClient dynamically to avoid circular dependencies
            const { queryClient } = await import('../lib/queryClient.ts');
            
            // Remove project from projects list cache
            queryClient.setQueriesData(
              { 
                queryKey: ['projects', 'list'],
                exact: false
              },
              (oldData: any) => {
                if (!oldData) return oldData;
                const isArray = Array.isArray(oldData);
                const projects = isArray ? oldData : (oldData.projects || []);
                const filteredProjects = projects.filter((project: any) => project.id !== projectId);
                return isArray ? filteredProjects : { ...oldData, projects: filteredProjects };
              }
            );
            
            // Clear selected project if it's the one being accessed
            const selectedProject = localStorage.getItem('selectedProjectId');
            if (selectedProject === projectId) {
              localStorage.removeItem('selectedProjectId');
            }
            
            // Invalidate project detail cache
            queryClient.removeQueries({ queryKey: ['projects', 'detail', projectId] });
          }
        }
      }
    }

    // Normalize error messages
    const data = error.response?.data as any;
    const status = error.response?.status;
    // Get URL from originalRequest if available, otherwise from error.config or error
    const url = originalRequest?.url || error.config?.url || error.request?.responseURL || undefined;
    
    // For auth routes and public routes, never log as "token expired" - these are expected 401s
    const isAuthRouteError = isAuthRoute(url);
    const isPublicRouteError = isPublicRoute(url);
    const isUnauthenticatedRoute = isAuthRouteError || isPublicRouteError;
    
    // Suppress repeated "Token expired" errors after logout/auth clear
    // BUT: Never treat auth/public route 401s as token expiration errors
    const isTokenExpiredError = !isUnauthenticatedRoute && (
      error.message === 'Token expired' ||
      data?.message === 'Token expired' ||
      data?.detail === 'Token expired'
    );
    
    // Only log errors that aren't expected token expiration errors
    // (Token expiration is handled above and should not spam console)
    // Auth/public routes should log normally (they're not token expiration issues)
    if (!isTokenExpiredError || !(window as any).__tokenExpiredLogged) {
      // Log detailed error information for debugging (only once for token errors)
      if (isTokenExpiredError) {
        (window as any).__tokenExpiredLogged = true;
      }
      // For auth/public routes, use a different log level (debug instead of error for expected 401s)
      if (isUnauthenticatedRoute && status === 401) {
        // Auth/public route 401s are expected (wrong credentials, invalid format, etc.) - don't log as error
        console.debug('Unauthenticated route 401 (expected):', { url, status, message: data?.message || error.message });
      } else {
        console.error('❌ API Error:', {
          url: url || 'unknown',
          status: status || 'unknown',
          data,
          message: error.message,
          config: originalRequest ? { method: originalRequest.method, url: originalRequest.url } : undefined
        });
      }
    }
    
    // Extract error message with priority: detail > title > error > message > default
    let message = "Request failed";
    if (data) {
      if (data.detail) {
        message = data.detail;
      } else if (data.title) {
        message = data.title;
      } else if (data.error) {
        message = data.error;
      } else if (data.message) {
        message = data.message;
      } else if (typeof data === "string") {
        message = data;
      }
    } else if (error.message) {
      message = error.message;
    }
    
    // Fallback: If 403 from auth route and no message extracted, provide user-friendly message
    if (status === 403 && (isAuthRouteError || isPublicRouteError) && message === "Request failed") {
      message = "Invalid credentials. Please check your username and password.";
    }
    
    // Preserve all error properties when creating normalized error
    const normalizedError = new Error(message) as any;
    normalizedError.status = status;
    normalizedError.response = error.response;
    normalizedError.config = originalRequest || error.config;
    normalizedError.request = error.request;
    normalizedError.originalError = error;
    normalizedError.responseData = data;
    // Preserve URL for debugging
    if (url) {
      normalizedError.url = url;
    }
    
    return Promise.reject(normalizedError);
  }
);

// Helper for creating authenticated request config (backward compatibility)
export const createAuthenticatedRequest = () => {
  const token = getAccessToken() || localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

// Standardized error handling
export const handleApiError = (error: any, operation = 'API operation') => {
  // Handle auth errors
  if (error.response?.status === 401) {
    console.error(`Authentication error during ${operation}`);
  }
  
  const message = error.response?.data?.message || error.message || `Error during ${operation}`;
  console.error(`❌ ${message}`, error);
  throw error;
};

export default api;


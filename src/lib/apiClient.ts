import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, ENDPOINTS } from '../config';

// In-memory storage for access token only (no localStorage)
let accessToken: string | null = null;
let isRefreshing = false;
let isOAuthFlow = false; // Task 2.2: Track OAuth flow to prevent token clearing during OAuth
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

/**
 * Set OAuth flow mode
 * Task 2.2: Used by AuthContext to signal OAuth flow in progress
 */
export const setOAuthFlow = (enabled: boolean): void => {
  isOAuthFlow = enabled;
};

/**
 * Check if OAuth flow is active
 * Task 4.2: Used to prevent token clearing during OAuth
 */
export const getOAuthFlow = (): boolean => {
  return isOAuthFlow;
};

/**
 * Get access token from memory
 */
export const getAccessToken = (): string | null => accessToken;

/**
 * Set access token in memory only
 */
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  if (token) {
    console.log('🔑 Token stored in memory');
  } else {
    console.log('🔑 Token cleared from memory');
  }
};

/**
 * Clear access token from memory
 */
export const clearAccessToken = (): void => {
  accessToken = null;
  console.log('🔑 Access token cleared');
};

/**
 * Refresh token function - ONE attempt only
 * 
 * Calls POST /api/v1/auth/refresh with no body - refresh token is in httpOnly cookie
 * Returns new access token: { "token": "...", "userID": "..." }
 * 
 * @returns Promise<string | null> New access token or null on failure
 */
export const refreshToken = async (): Promise<string | null> => {
  console.log('🔄 Starting token refresh');

  try {
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
      // Store userId in localStorage (needed for project selection, etc.)
      if (newUserId) {
        localStorage.setItem('userId', newUserId);
      }
      console.log('✅ Token refresh succeeded');
      return newToken;
    }

    throw new Error('Refresh token response missing token');
  } catch (error: any) {
    const status = error?.response?.status;
    const is401 = status === 401;

    console.log(`❌ Refresh token failed:`, {
      status,
      is401,
      message: error?.message,
    });

    if (is401) {
      // Task 4.2: Do not clear token on refresh 401 during OAuth
      if (!isOAuthFlow) {
        console.log('⚠️ Refresh token expired (401), clearing auth');
        clearAccessToken();
        // Clear userId as well
        localStorage.removeItem('userId');
      }
    }

    throw error;
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
  withCredentials: true // CRITICAL: Required for HttpOnly refresh token cookies
});

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
const isAuthRoute = (url: string | undefined): boolean => {
  if (!url) return false;
  return AUTH_ROUTES.some(route => url.includes(route));
};

// Helper to check if a URL is a public route that doesn't require auth
const isPublicRoute = (url: string | undefined): boolean => {
  if (!url) return false;
  return PUBLIC_ROUTES.some(route => url.includes(route));
};

// Request interceptor to add auth token from memory
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Skip auth headers for auth/public routes
    if (isAuthRoute(config.url) || isPublicRoute(config.url)) {
      return config;
    }
    
    // Attach token from memory only
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
    
    // Skip refresh logic for auth/public routes
    if (isAuthRoute(originalRequest?.url) || isPublicRoute(originalRequest?.url)) {
      return Promise.reject(error);
    }
    
    // Handle 401 errors with refresh token flow
    // Only attempt refresh if:
    // 1. Request is not an auth/public route
    // 2. Error is 401 (Unauthorized)
    // 3. Request hasn't been retried yet
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
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
        // Call refresh endpoint (ONE attempt only)
        const newToken = await refreshToken();
        
        if (!newToken) {
          throw new Error('Refresh returned null token');
        }
        
        // Process queued requests with new token
        processQueue(null, newToken);
        
        // Update original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        
        // Retry original request with new token
        return api(originalRequest);
      } catch (refreshError: any) {
        // Refresh failed - process queue with error
        processQueue(refreshError, null);

        const is401 = refreshError?.response?.status === 401;
        if (is401) {
          // Task 4.2: Do not clear token on refresh 401 during OAuth
          if (!isOAuthFlow) {
            // Refresh token expired - logout will be handled by AuthContext state machine
            console.log('⚠️ Refresh token expired (401), auth state will be unauthenticated');
          }
        }

        // Return the original 401 error
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    
    // Handle 403 errors for project access (user was removed from project)
    if (error.response?.status === 403) {
      const url = originalRequest?.url || error.config?.url || error.request?.responseURL || '';
      
      if (!isAuthRoute(url) && !isPublicRoute(url)) {
        const projectIdMatch = url.match(/\/projects\/([^/]+)/);
        
        if (projectIdMatch && projectIdMatch[1]) {
          const projectId = projectIdMatch[1];
          const currentUserId = localStorage.getItem('userId');
          
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
            const { getSelectedProject } = await import('../services/storageService');
            const selectedProject = getSelectedProject(currentUserId);
            if (selectedProject === projectId) {
              const { clearSelectedProject } = await import('../services/storageService');
              clearSelectedProject(currentUserId);
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
    const url = originalRequest?.url || error.config?.url || error.request?.responseURL || undefined;
    
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
    const isAuthRouteError = isAuthRoute(url);
    const isPublicRouteError = isPublicRoute(url);
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
    if (url) {
      normalizedError.url = url;
    }
    
    return Promise.reject(normalizedError);
  }
);

// Helper for creating authenticated request config (backward compatibility)
export const createAuthenticatedRequest = () => {
  const token = getAccessToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

// Standardized error handling
export const handleApiError = (error: any, operation = 'API operation') => {
  if (error.response?.status === 401) {
    console.error(`Authentication error during ${operation}`);
  }
  
  const message = error.response?.data?.message || error.message || `Error during ${operation}`;
  console.error(`❌ ${message}`, error);
  throw error;
};

export default api;

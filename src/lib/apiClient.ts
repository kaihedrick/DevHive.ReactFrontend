import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, ENDPOINTS } from '../config';

// Token expiration tracking
const TOKEN_EXPIRATION_KEY = 'tokenExpiration';
const TOKEN_VALIDITY_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// In-memory storage for access token (not localStorage for security)
let accessToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

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

// Check if token is expired
export const isTokenExpired = (): boolean => {
  const expirationTimestamp = localStorage.getItem(TOKEN_EXPIRATION_KEY);
  if (!expirationTimestamp) {
    // No expiration timestamp - consider expired if token exists (legacy token)
    return !!localStorage.getItem('token');
  }
  
  const expirationTime = parseInt(expirationTimestamp, 10);
  const now = Date.now();
  
  // Token is expired if current time is past expiration time
  return now > expirationTime;
};

// Check if token is expired beyond 24-hour window
export const isTokenExpiredBeyondWindow = (): boolean => {
  const expirationTimestamp = localStorage.getItem(TOKEN_EXPIRATION_KEY);
  if (!expirationTimestamp) {
    return true; // No expiration timestamp means token is invalid
  }
  
  const expirationTime = parseInt(expirationTimestamp, 10);
  const now = Date.now();
  const windowEnd = expirationTime + TOKEN_VALIDITY_DURATION;
  
  // Token is expired beyond 24-hour window if current time is past window end
  return now > windowEnd;
};

// Set access token in memory
export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  // Also update localStorage for backward compatibility during migration
  if (token) {
    localStorage.setItem('token', token);
    // Store expiration timestamp (24 hours from now)
    const expirationTime = Date.now() + TOKEN_VALIDITY_DURATION;
    localStorage.setItem(TOKEN_EXPIRATION_KEY, expirationTime.toString());
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

// Refresh token function
export const refreshToken = async (): Promise<string | null> => {
  try {
    const response = await api.post(ENDPOINTS.AUTH_REFRESH, {}, {
      withCredentials: true
    });
    
    const { token, Token, userId } = response.data;
    const newToken = token || Token;
    
    if (newToken && userId) {
      setAccessToken(newToken);
      localStorage.setItem('userId', userId);
      return newToken;
    }
    
    throw new Error('Refresh token response missing token or userId');
  } catch (error) {
    clearAccessToken();
    throw error;
  }
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Don't add auth header to public auth endpoints
    const isPublicAuthEndpoint = 
      config.url?.includes('/auth/login') ||
      config.url?.includes('/auth/password/reset-request') ||
      config.url?.includes('/auth/password/reset') ||
      (config.method === 'post' && config.url?.endsWith('/users') && !config.url?.includes('/users/'));
    
    if (!isPublicAuthEndpoint) {
      // Check if token is expired beyond 24-hour window
      if (isTokenExpiredBeyondWindow()) {
        console.warn('⚠️ Token expired beyond 24-hour window, clearing auth state');
        clearAccessToken();
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
        return Promise.reject(new Error('Token expired'));
      }
      
      const token = getAccessToken() || localStorage.getItem('token');
      if (token) {
        // Check if token is expired (but within 24-hour window - allow refresh)
        if (isTokenExpired() && !isRefreshing) {
          // Token expired but within window - attempt refresh in background
          // Don't block the request, let the response interceptor handle it
          console.log('⚠️ Token expired, will attempt refresh on 401');
        }
        
        config.headers.Authorization = `Bearer ${token}`;
        // Initialize in-memory token if it exists in localStorage
        if (!accessToken) {
          accessToken = token;
        }
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
    
    // Handle 401 errors with refresh token flow
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshToken();
        processQueue(null, newToken);
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Clear auth state and redirect to login
        clearAccessToken();
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Normalize error messages
    const data = error.response?.data as any;
    const status = error.response?.status;
    const url = originalRequest?.url;
    
    // Log detailed error information for debugging
    console.error('❌ API Error:', {
      url,
      status,
      data,
      message: error.message
    });
    
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
    
    // Create a new error with the normalized message
    const normalizedError = new Error(message) as any;
    normalizedError.status = status;
    normalizedError.originalError = error;
    normalizedError.responseData = data;
    
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


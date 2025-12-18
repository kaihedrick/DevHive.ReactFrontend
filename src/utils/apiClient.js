import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAuthToken } from '../services/authService'; // Changed path

// Create axios instance with default config
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to all requests except public auth endpoints
api.interceptors.request.use(config => {
  // Don't add auth header to login, password reset endpoints, or POST /users (registration)
  const isPublicAuthEndpoint = 
    config.url?.includes('/auth/login') ||
    config.url?.includes('/auth/password/reset-request') ||
    config.url?.includes('/auth/password/reset') ||
    (config.method === 'post' && config.url?.endsWith('/users') && !config.url?.includes('/users/'));
  
  if (!isPublicAuthEndpoint) {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, error => Promise.reject(error));

// Helper for creating authenticated request config (keeping backward compatibility)
export const createAuthenticatedRequest = () => {
  const token = getAuthToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

// Standardized error handling
export const handleApiError = (error, operation = 'API operation') => {
  // Handle auth errors
  if (error.response?.status === 401) {
    console.error(`Authentication error during ${operation}`);
    // You might want to redirect to login here
  }
  
  const message = error.response?.data?.message || error.message || `Error during ${operation}`;
  console.error(`❌ ${message}`, error);
  throw error;
};

// Add response interceptor to normalize all errors to strings
api.interceptors.response.use(
  response => response,
  error => {
    const data = error?.response?.data;
    const status = error.response?.status;
    const url = error.config?.url;
    
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
        message = data.detail; // Backend returns "Invalid credentials" in detail field
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
    const normalizedError = new Error(message);
    normalizedError.status = status;
    normalizedError.originalError = error;
    normalizedError.responseData = data;
    
    return Promise.reject(normalizedError);
  }
);
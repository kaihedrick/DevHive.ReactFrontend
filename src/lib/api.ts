import axios from 'axios';

// Get environment variable with fallback
const getApiBaseUrl = () => {
  try {
    // Check if we're in a Vite environment
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env.VITE_API_BASE_URL ?? 'https://go.devhive.it.com/api/v1';
    }
    // Fallback for development
    return (process as any).env.REACT_APP_API_BASE_URL ?? 'https://go.devhive.it.com/api/v1';
  } catch (error) {
    // Fallback if environment variables are not available
    return 'https://go.devhive.it.com/api/v1';
  }
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token (skip public auth endpoints)
api.interceptors.request.use(config => {
  // Don't add auth header to login, password reset endpoints, or POST /users (registration)
  const isPublicAuthEndpoint = 
    config.url?.includes('/auth/login') ||
    config.url?.includes('/auth/password/reset-request') ||
    config.url?.includes('/auth/password/reset') ||
    (config.method === 'post' && config.url?.endsWith('/users') && !config.url?.includes('/users/'));
  
  if (!isPublicAuthEndpoint) {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const problem = error.response?.data;
    const message = problem?.detail || problem?.title || error.message;
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      window.location.href = '/';
    }
    
    const normalizedError = new Error(message) as any;
    normalizedError.status = error.response?.status;
    normalizedError.originalError = error;
    return Promise.reject(normalizedError);
  }
);

export default api;
import axios from 'axios';

// Get environment variable with fallback
const getApiBaseUrl = () => {
  try {
    // Check if we're in a Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_API_BASE_URL ?? 'https://devhive-go-backend.fly.dev/api/v1';
    }
    // Fallback for development
    return process.env.REACT_APP_API_BASE_URL ?? 'https://devhive-go-backend.fly.dev/api/v1';
  } catch (error) {
    // Fallback if environment variables are not available
    return 'https://devhive-go-backend.fly.dev/api/v1';
  }
};

// Use new Go backend with v1 API
axios.defaults.baseURL = getApiBaseUrl();

// Add a request interceptor
axios.interceptors.request.use(
  (config) => {
    // Make sure all URLs use HTTPS
    if (config.url && config.url.startsWith('http:')) {
      config.url = config.url.replace('http:', 'https:');
    }
    
    // Add auth token to all requests
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// RFC-7807 error handling
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const problem = err.response?.data;
    const message = problem?.detail || problem?.title || err.message;
    
    // Handle specific error types
    if (err.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      window.location.href = '/';
    }
    
    // Create normalized error
    const normalizedError = new Error(message);
    normalizedError.status = err.response?.status;
    normalizedError.originalError = err;
    
    return Promise.reject(normalizedError);
  }
);

export default axios;

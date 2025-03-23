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

// Add auth token to all requests
api.interceptors.request.use(config => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
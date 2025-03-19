//utils/apiClient.js
import axios from 'axios';
import { getAuthToken } from '../services/authService';

export const createAuthenticatedRequest = () => {
  const token = getAuthToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

export const handleApiError = (error, context) => {
  console.error(`❌ Error ${context}:`, error.response?.data || error.message);
  throw error;
};

export const api = axios.create();

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
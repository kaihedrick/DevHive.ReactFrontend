//authService.js
import { api, handleApiError } from '../utils/apiClient';
import { ENDPOINTS } from '../config';

// Local Storage Management
export const getAuthToken = () => localStorage.getItem('token');
export const getUserId = () => localStorage.getItem('userId');

export const storeAuthData = (token, userId) => {
  localStorage.setItem('token', token);
  localStorage.setItem('userId', userId);
};

export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
};

// API Calls
export const validateEmail = async (email) => {
  try {
    const response = await api.post(
      `${ENDPOINTS.USER}/ValidateEmail`,
      JSON.stringify(email),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    // If the response is 200, it means the email is available
    return {
      isAvailable: true,
      message: response.data, // "Email is available."
    };
  } catch (error) {
    // If the response is 409, it means the email is already in use
    if (error.response?.status === 409) {
      return {
        isAvailable: false,
        message: error.response.data, // "Email is already in use."
      };
    }
    // If the response is 400, it means the email is invalid
    if (error.response?.status === 400) {
      return {
        isAvailable: false,
        message: error.response.data, // "Email is required."
      };
    }
    // For any other error, return a generic error message
    return {
      isAvailable: false,
      message: "An error occurred while validating the email.",
    };
  }
};

export const login = async (credentials) => {
  try {
    const response = await api.post(`${ENDPOINTS.USER}/ProcessLogin`, credentials);
    const { token, userId } = response.data;

    if (token && userId) {
      storeAuthData(token, userId);
      console.log('✅ Login successful');
    }
    return response.data;
  } catch (error) {
    return handleApiError(error, 'logging in');
  }
};

export const register = async (userData) => {
  try {
    const response = await api.post(ENDPOINTS.USER, userData);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'registering user');
  }
};

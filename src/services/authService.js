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
    const response = await api.post(ENDPOINTS.VALIDATE_EMAIL,  JSON.stringify(email), {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      return false; // Email is available
    } else {
      return true; // Email is already in use
    }
  } catch (error) {
    if (error.response && error.response.status === 409) {
      return true; // Email is already in use
    } else {
      console.error("❌ Error validating email:", error);
      throw error;
    }
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
    throw handleApiError(error, 'logging in'); // Throw the error
  }
};

export const register = async (userData) => {
  try {
    const response = await api.post(ENDPOINTS.USER, userData);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'registering user'); // Throw the error
  }
};

// Add to authService.js
export const requestPasswordReset = async (email) => {
  try {
    // Send the email as a raw JSON string, not as an object
    await api.post(`${ENDPOINTS.USER}/RequestPasswordReset`, JSON.stringify(email), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Password reset email sent');
  } catch (error) {
    console.error("❌ Error requesting password reset:", error);
    throw error;
  }
};

export const resetPassword = async (resetData) => {
  try {
    await api.post(`${ENDPOINTS.USER}/ResetPassword`, resetData);
    console.log('✅ Password reset successful');
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    throw error;
  }
};
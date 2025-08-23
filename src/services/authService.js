//authService.js
import { api, handleApiError } from '../utils/apiClient';
import { ENDPOINTS } from '../config';

/**
 * @function getAuthToken
 * @description Retrieves the authentication token from localStorage.
 * @returns {string | null} - The stored JWT token or null if not found.
 */
export const getAuthToken = () => localStorage.getItem('token');
/**
 * @function getUserId
 * @description Retrieves the user ID from localStorage.
 * @returns {string | null} - The stored user ID or null if not found.
 */
export const getUserId = () => localStorage.getItem('userId');
/**
 * @function storeAuthData
 * @description Stores the JWT token and user ID in localStorage.
 * @param {string} token - The authentication token.
 * @param {string} userId - The user's ID.
 */
export const storeAuthData = (token, userId) => {
  localStorage.setItem('token', token);
  localStorage.setItem('userId', userId);
};
/**
 * @function clearAuth
 * @description Clears the stored authentication token and user ID from localStorage.
 */
export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
};

/**
 * @function validateEmail
 * @description Checks if an email is already registered.
 * @param {string} email - The email to validate.
 * @returns {Promise<boolean>} - True if the email is taken, false otherwise.
 */
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
/**
 * @function login
 * @description Sends login credentials and stores token on success.
 * @param {Object} credentials - The user credentials (email and password).
 * @returns {Promise<Object>} - The login response data.
 */
export const login = async (credentials) => {
  try {
    // Transform PascalCase to camelCase for backend compatibility
    const loginPayload = {
      username: credentials.Username || credentials.username,
      password: credentials.Password || credentials.password
    };
    
    const response = await api.post(`${ENDPOINTS.USER}/ProcessLogin`, loginPayload);
    const { token, userId } = response.data;

    if (token && userId) {
      storeAuthData(token, userId);
      console.log('✅ Login successful');
    }
    return response.data;
  } catch (error) {
    // Error is already normalized by the interceptor
    throw error;
  }
};
/**
 * @function register
 * @description Registers a new user with the provided data.
 * @param {Object} userData - The registration data.
 * @returns {Promise<Object>} - The registration response data.
 */
export const register = async (userData) => {
  try {
    const response = await api.post(ENDPOINTS.USER, userData);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'registering user'); // Throw the error
  }
};

/**
 * @function requestPasswordReset
 * @description Sends a password reset request for the specified email.
 * @param {string} email - The user's email address.
 */
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
/**
 * @function resetPassword
 * @description Submits the new password and reset token for update.
 * @param {Object} resetData - The reset data including token and new password.
 */
export const resetPassword = async (resetData) => {
  try {
    await api.post(`${ENDPOINTS.USER}/ResetPassword`, resetData);
    console.log('✅ Password reset successful');
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    throw error;
  }
};
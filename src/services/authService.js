//authService.js
import { api, handleApiError } from '../utils/apiClient';
import { ENDPOINTS } from '../config';
import { sendPasswordResetEmail } from './mailService';

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
  const res = await api.post("/users/validate-email", { email });
  return !res.data?.available; // Invert: available=true means not taken, so we return !available
};

/**
 * @function validateUsername
 * @description Checks if a username is already registered.
 * @param {string} username - The username to validate.
 * @returns {Promise<boolean>} - True if the username is taken, false otherwise.
 */
export const validateUsername = async (username) => {
  const res = await api.post("/users/validate-username", { username });
  return !res.data?.available; // Invert: available=true means not taken, so we return !available
};
/**
 * @function login
 * @description Sends login credentials and stores token on success.
 * @param {Object} credentials - The user credentials (email and password).
 * @returns {Promise<Object>} - The login response data.
 */
export const login = async (credentials) => {
  try {
    // Use new Go backend login endpoint - expects username and password
    const loginPayload = {
      username: credentials.username || credentials.Username,
      password: credentials.password || credentials.Password
    };
    
    console.log('🔐 Attempting login to:', ENDPOINTS.AUTH_LOGIN);
    console.log('📤 Login payload:', { username: loginPayload.username, password: '***' });
    
    const response = await api.post(ENDPOINTS.AUTH_LOGIN, loginPayload);
    console.log('📥 Login response:', response.data);
    
    const { token, userId, Token } = response.data; // Handle both token and Token

    const authToken = token || Token;
    if (authToken && userId) {
      storeAuthData(authToken, userId);
      console.log('✅ Login successful');
    } else {
      console.warn('⚠️ Login response missing token or userId:', response.data);
    }
    return response.data;
  } catch (error) {
    const errorDetails = {
      message: error.message,
      status: error.status,
      responseData: error.responseData || error.response?.data,
      responseHeaders: error.response?.headers,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method,
      requestData: error.config?.data
    };
    console.error('❌ Login error details:', errorDetails);
    console.error('❌ Full error object:', error);
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
    const response = await api.post(ENDPOINTS.USERS, userData);
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
    // Use new Go backend password reset endpoint - expects email only
    const response = await api.post(ENDPOINTS.AUTH_PASSWORD_RESET_REQUEST, { email });
    
    // If the backend returns a token (for development), send the email
    if (response.data.token) {
      try {
        await sendPasswordResetEmail(email, response.data.token);
        console.log('✅ Password reset email sent successfully');
      } catch (emailError) {
        console.warn('⚠️ Password reset token created but email failed:', emailError);
        // Don't throw here - the token was created successfully
      }
    }
    
    console.log('✅ Password reset request sent:', response.data.message);
    return response.data;
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
    // Use new Go backend password reset endpoint - expects token and password
    const payload = {
      token: resetData.token,
      password: resetData.password
    };
    
    const response = await api.post(ENDPOINTS.AUTH_PASSWORD_RESET, payload);
    console.log('✅ Password reset successful:', response.data.message);
    return response.data;
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    throw error;
  }
};
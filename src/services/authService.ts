import { api, handleApiError, setAccessToken, clearAccessToken, getAccessToken, refreshToken as refreshAccessToken } from '../lib/apiClient.ts';
import { ENDPOINTS } from '../config';
import { EmailRequest } from '../models/email.ts';
import { ResetPasswordModel, ChangePasswordModel } from '../models/password.ts';
import { LoginModel, UserModel } from '../models/user.ts';
import axios from 'axios';

// Define interfaces for type safety
export interface AuthToken {
  Token: string;  // Change to match backend
  userId: string; // Keep lowercase as returned by API
}

/**
 * @function getAuthToken
 * @returns {string | null} Retrieves JWT token from memory.
 */
export const getAuthToken = (): string | null => getAccessToken();

/**
 * @function getUserId
 * @returns {string | null} Retrieves user ID from localStorage.
 */
export const getUserId = (): string | null => localStorage.getItem('userId');

/**
 * @function storeAuthData
 * @param {string} token - JWT token to store.
 * @param {string} userId - User ID to store.
 * Stores token in memory and userId in localStorage.
 */
export const storeAuthData = (token: string, userId: string): void => {
  setAccessToken(token);
  localStorage.setItem('userId', userId);
};

/**
 * @function clearAuthData
 * Clears stored authentication and selected project data.
 */
export const clearAuthData = (): void => {
  clearAccessToken();
  localStorage.removeItem('userId');
  // Note: selectedProjectId is cleared by storageService.clearSelectedProject()
};

// Alias for backward compatibility
export const clearAuth = clearAuthData;

/**
 * @function getSelectedProject
 * @returns {string | null} Retrieves the currently selected project ID.
 */
export const getSelectedProject = (): string | null => localStorage.getItem('selectedProjectId');
/**
 * @function setSelectedProject
 * @param {string} projectId - Sets the selected project ID.
 */

export const setSelectedProject = (projectId: string): void => localStorage.setItem('selectedProjectId', projectId);
/**
 * @function clearSelectedProject
 * Removes the selected project ID from localStorage.
 */

export const clearSelectedProject = (): void => localStorage.removeItem('selectedProjectId');

/**
 * @function isAuthenticated
 * @returns {boolean} Checks if a user is currently authenticated.
 * Note: This checks for token in memory, not localStorage.
 */
export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};

/**
 * @function validateEmail
 * @param {string} email - Email to validate for availability and format.
 * @returns {Promise<{ available: boolean }>} Object with available property indicating if email is available.
 */
export const validateEmail = async (email: string): Promise<{ available: boolean }> => {
  try {
    // Use GET with query params (can also use POST with body)
    const response = await api.get('/users/validate-email', {
      params: { email }
    });

    if (response.status === 200) {
      return response.data; // { available: true/false }
    } else {
      return { available: false }; // Default to unavailable on unexpected status
    }
  } catch (error: any) {
    if (error.response?.status === 400) {
      // Invalid email format
      throw new Error('Invalid email format');
    } else if (error.response?.status === 409) {
      // Email is already in use
      return { available: false };
    } else {
      console.error("❌ Error validating email:", error);
      throw error;
    }
  }
};

/**
 * @function validateUsername
 * @param {string} username - Username to validate.
 * @param {string} [currentUsername] - Optional current username to skip validation.
 * @returns {Promise<boolean>} True if username is taken, false if available or unchanged.
 */
export const validateUsername = async (username: string, currentUsername?: string): Promise<boolean> => {
  // Skip validation if username is unchanged
  if (username === currentUsername) {
    console.log("✅ Username unchanged, no need to validate");
    return false; // Not taken (valid)
  }

  try {
    console.log(`Validating username: "${username}"`);
    
    // Use the api client for correct error handling
    const response = await api.post(ENDPOINTS.USER_VALIDATE_USERNAME, JSON.stringify(username), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    console.log("Username validation response status:", response.status);
    
    // 200 OK means username is available (not taken)
    console.log("✅ Username validation successful, username is available");
    return false; // Username is NOT taken
  } catch (error: any) {
    // 409 Conflict means username is taken
    if (error.response?.status === 409) {
      console.log("❌ Username is already in use - 409 Conflict");
      return true; // Username IS taken
    }

    // For any other error, log and proceed with update
    console.error("❌ Error validating username:", error);
    console.log("Proceeding without validation result");
    return false; // Assume username is available to let update proceed
  }
};
/**
 * @function login
 * @param {LoginModel} credentials - User login credentials.
 * @param {boolean} [rememberMe] - Optional "Remember Me" flag for persistent login.
 * @returns {Promise<AuthToken>} Auth token and user ID if successful.
 */
export const login = async (credentials: LoginModel | any, rememberMe?: boolean): Promise<AuthToken> => {
  try {
    // Backend expects username, password, and optional rememberMe
    // Handle both capitalized (Username/Password) and lowercase (username/password) field names
    const loginData: any = {
      username: credentials.username || credentials.Username,
      password: credentials.password || credentials.Password
    };
    
    // Add rememberMe if provided
    if (rememberMe !== undefined) {
      loginData.rememberMe = rememberMe;
    }
    
    const response = await api.post(ENDPOINTS.AUTH_LOGIN, loginData);
    const { Token, userId, token } = response.data; // Handle both Token and token (case variations)

    const authToken = Token || token;
    if (authToken && userId) {
      storeAuthData(authToken, userId);
      console.log('✅ Login successful');
      // Refresh token is stored as HttpOnly cookie by backend with appropriate MaxAge based on rememberMe
    } else {
      console.warn('⚠️ Login response missing token or userId:', response.data);
    }
    return response.data;
  } catch (error) {
    console.error('❌ Login error:', error);
    throw handleApiError(error, 'logging in');
  }
};

/**
 * @function initiateGoogleOAuth
 * Initiates Google OAuth 2.0 login flow by getting authorization URL from backend.
 * @param {boolean} [rememberMe] - Optional "Remember Me" flag for persistent login.
 * @param {string} [redirectUrl] - Optional frontend URL to redirect after successful auth.
 * @returns {Promise<{authUrl: string, state: string}>} Authorization URL and state token.
 */
export const initiateGoogleOAuth = async (
  rememberMe: boolean = false, 
  redirectUrl?: string
): Promise<{authUrl: string, state: string}> => {
  try {
    const params: any = {
      remember_me: rememberMe
    };
    
    if (redirectUrl) {
      params.redirect = redirectUrl;
    }
    
    console.log('🔐 Initiating Google OAuth with:', { rememberMe, redirectUrl });
    const response = await api.get(ENDPOINTS.AUTH_GOOGLE_LOGIN, { params });
    
    if (response.data?.authUrl && response.data?.state) {
      console.log('✅ Google OAuth URL received');
      return {
        authUrl: response.data.authUrl,
        state: response.data.state
      };
    } else {
      throw new Error('Invalid OAuth response: missing authUrl or state');
    }
  } catch (error) {
    console.error('❌ Google OAuth initiation error:', error);
    throw handleApiError(error, 'initiating Google OAuth');
  }
};

/**
 * @interface GoogleOAuthCallbackResponse
 * Response structure from Google OAuth callback endpoint
 */
export interface GoogleOAuthCallbackResponse {
  token: string;
  userId: string;
  isNewUser?: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

/**
 * @function handleGoogleOAuthCallback
 * Handles Google OAuth callback by exchanging authorization code for tokens.
 * @param {string} code - Authorization code from Google.
 * @param {string} state - CSRF state token.
 * @returns {Promise<GoogleOAuthCallbackResponse>} Auth token, user ID, and user info if successful.
 */
export const handleGoogleOAuthCallback = async (code: string, state: string): Promise<GoogleOAuthCallbackResponse> => {
  try {
    if (!code || !state) {
      throw new Error('Missing authorization code or state token');
    }
    
    console.log('🔐 Handling Google OAuth callback');
    const response = await api.get(ENDPOINTS.AUTH_GOOGLE_CALLBACK, {
      params: { code, state }
    });
    
    // Handle both Token/token variations and userId/user_id
    const { Token, userId, token, user_id, isNewUser, user } = response.data;
    const authToken = Token || token;
    const finalUserId = userId || user_id;
    
    if (authToken && finalUserId) {
      // Store the access token (for API requests)
      storeAuthData(authToken, finalUserId);
      console.log('✅ Google OAuth login successful', { 
        userId: finalUserId, 
        isNewUser,
        hasUserInfo: !!user 
      });
      // Refresh token is stored as HttpOnly cookie by backend
    } else {
      console.warn('⚠️ OAuth callback response missing token or userId:', response.data);
      throw new Error('Invalid OAuth response: missing token or userId');
    }
    
    // Return structured response
    return {
      token: authToken,
      userId: finalUserId,
      isNewUser: isNewUser || false,
      user: user || undefined
    };
  } catch (error) {
    console.error('❌ Google OAuth callback error:', error);
    throw handleApiError(error, 'completing Google OAuth');
  }
};
/**
 * @function refreshToken
 * Refreshes the access token using the refresh token cookie.
 * @returns {Promise<AuthToken>} New auth token and user ID if successful.
 * 
 * CRITICAL: Only clears auth data on 401 errors (refresh token expired).
 * Network errors, 500s, timeouts should NOT clear tokens - the refresh token
 * cookie might still be valid and the user should be able to retry.
 * 
 * Related Documentation:
 * - .agent/Tasks/fix_authentication_15min_logout.md - Fix 1: Align with apiClient.ts pattern
 */
export const refreshToken = async (): Promise<AuthToken> => {
  try {
    const newToken = await refreshAccessToken();
    const userId = localStorage.getItem('userId');
    
    if (newToken && userId) {
      return { Token: newToken, userId };
    }
    
    throw new Error('Refresh token response missing token or userId');
  } catch (error) {
    // Error handling is done in apiClient.refreshToken()
    // It already clears auth data on 401
    throw error;
  }
};

/**
 * @function logout
 * Logs out the current user and clears session data.
 * Note: Refresh token cookie is cleared by backend on logout endpoint if called.
 */
export const logout = (): void => {
  clearAuthData();
  console.log('✅ Logged out successfully');
};
/**
 * @function register
 * @param {UserModel} userData - New user registration data.
 * @returns {Promise<any>} API response data from registration.
 */
export const register = async (userData: UserModel): Promise<any> => {
  try {
    // Registration is POST /users/, not /auth/register
    const response = await api.post(ENDPOINTS.USERS, userData);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'registering user');
  }
};
/**
 * @function requestPasswordReset
 * @param {string} email - Email to request a password reset for.
 * Sends reset request to backend using JSON payload.
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    // Send the email as a raw JSON string to match [FromBody] string email
    await api.post(ENDPOINTS.AUTH_PASSWORD_RESET_REQUEST, JSON.stringify(email), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Password reset email sent');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("❌ Error requesting password reset:", error.response?.data || error.message);
      throw new Error(error.response?.data || 'Error requesting password reset');
    } else {
      console.error("❌ Error requesting password reset:", error);
      throw new Error('Error requesting password reset');
    }
  }
};
/**
 * @function resetPassword
 * @param {ResetPasswordModel} resetData - Data to reset the user's password.
 * Completes password reset process.
 */
export const resetPassword = async (resetData: ResetPasswordModel): Promise<void> => {
  try {
    await api.post(ENDPOINTS.AUTH_PASSWORD_RESET, resetData);
    console.log('✅ Password reset successful');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("❌ Error resetting password:", error.response?.data || error.message);
      throw new Error(error.response?.data || 'Error resetting password');
    } else {
      console.error("❌ Error resetting password:", error);
      throw new Error('Error resetting password');
    }
  }
};
/**
 * @function confirmPasswordReset
 * @param {string} token - Password reset token.
 * @param {string} newPassword - New password to set.
 * Confirms password reset with provided token and password.
 */
export const confirmPasswordReset = async (token: string, newPassword: string): Promise<void> => {
  try {
    await api.post(`${ENDPOINTS.USER}/ResetPassword`, {
      Token: token,
      NewPassword: newPassword
    });
    console.log('✅ Password reset confirmed');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("❌ Error confirming password reset:", error.response?.data || error.message);
      throw new Error(error.response?.data || 'Error confirming password reset');
    } else {
      console.error("❌ Error confirming password reset:", error);
      throw new Error('Error confirming password reset');
    }
  }
};
/**
 * @function changePassword
 * @param {ChangePasswordModel} passwordData - Payload to change password for authenticated user.
 * Changes user password via backend.
 */
export const changePassword = async (passwordData: ChangePasswordModel): Promise<void> => {
  try {
    // Password change is PATCH /users/me/password, not /auth/password/change
    await api.patch(`${ENDPOINTS.USER_ME}/password`, passwordData);
    console.log('✅ Password changed successfully');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("❌ Error changing password:", error.response?.data || error.message);
      throw new Error(error.response?.data || 'Error changing password');
    } else {
      console.error("❌ Error changing password:", error);
      throw new Error('Error changing password');
    }
  }
};

/**
 * @function sendEmail
 * @param {EmailRequest} emailRequest - Email content and metadata.
 * Sends an email through the backend service.
 */
export const sendEmail = async (emailRequest: EmailRequest): Promise<void> => {
  try {
    await api.post(`${ENDPOINTS.EMAIL}/send`, emailRequest);
    console.log('✅ Email sent successfully');
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};
import { api, handleApiError } from '../utils/apiClient';
import { ENDPOINTS } from '../config';
import { EmailRequest } from '../models/email';
import { ResetPasswordModel, ChangePasswordModel } from '../models/password';
import { LoginModel, UserModel } from '../models/user';
import axios, { AxiosError } from 'axios';

// Define interfaces for type safety
export interface AuthToken {
  Token: string;  // Change to match backend
  userId: string; // Keep lowercase as returned by API
}

// Local Storage Management
export const getAuthToken = (): string | null => localStorage.getItem('token');
export const getUserId = (): string | null => localStorage.getItem('userId');

export const storeAuthData = (token: string, userId: string): void => {
  localStorage.setItem('token', token);
  localStorage.setItem('userId', userId);
};

export const clearAuth = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
};

// Helper function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

// API Calls
export const validateEmail = async (email: string): Promise<boolean> => {
  try {
    // This sends a raw string which matches your C# [FromBody] string email parameter
    const response = await api.post(ENDPOINTS.VALIDATE_EMAIL, JSON.stringify(email), {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      return false; // Email is available
    } else {
      return true; // Email is already in use
    }
  } catch (error: any) {
    if (error.response && error.response.status === 409) {
      return true; // Email is already in use
    } else {
      console.error("❌ Error validating email:", error);
      throw error;
    }
  }
};

export const login = async (credentials: LoginModel): Promise<AuthToken> => {
  try {
    const response = await api.post(`${ENDPOINTS.USER}/ProcessLogin`, credentials);
    const { Token, userId } = response.data;

    if (Token && userId) {
      storeAuthData(Token, userId);
      console.log('✅ Login successful');
    }
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'logging in');
  }
};

export const logout = (): void => {
  clearAuth();
  console.log('✅ Logged out successfully');
};

export const register = async (userData: UserModel): Promise<any> => {
  try {
    const response = await api.post(ENDPOINTS.USER, userData);
    return response.data;
  } catch (error) {
    throw handleApiError(error, 'registering user');
  }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    // Send the email as a raw JSON string to match [FromBody] string email
    await api.post(`${ENDPOINTS.USER}/RequestPasswordReset`, JSON.stringify(email), {
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

export const resetPassword = async (resetData: ResetPasswordModel): Promise<void> => {
  try {
    await api.post(`${ENDPOINTS.USER}/ResetPassword`, resetData);
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

export const changePassword = async (passwordData: ChangePasswordModel): Promise<void> => {
  try {
    await api.post(`${ENDPOINTS.USER}/ChangePassword`, passwordData);
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
 * Sends an email using the backend email service
 * @param emailRequest The email request details
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
// ✅ ADD THIS FUNCTION
export const updateUserProfile = async (userData) => {
  const response = await api.put(`/users/${userData.ID}`, userData);
  return response.data;
};
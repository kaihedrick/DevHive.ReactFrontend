import { api, handleApiError } from '../utils/apiClient';
import { ENDPOINTS } from '../config';
import { UserModel, UserProfile } from '../models/user.ts';

// Utility to sanitize update payload
const cleanUserUpdatePayload = (user: Partial<UserModel>): Partial<UserModel> => {
  const sanitized: Partial<UserModel> = {
    ID: user.ID,
    Username: user.Username,
    Email: user.Email,
    FirstName: user.FirstName,
    LastName: user.LastName,
  };

  if (user.Password && user.Password.trim() !== '') {
    sanitized.Password = user.Password;
  }

  return sanitized;
};

// Fetch a user by ID
export const fetchUserById = async (userId: string): Promise<UserModel> => {
  try {
    const response = await api.get(`${ENDPOINTS.USER}/${userId}`);
    return response.data as UserModel;
  } catch (error) {
    throw handleApiError(error, 'fetching user');
  }
};

// Get user profile with calculated properties
export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  try {
    const user = await fetchUserById(userId);
    return new UserProfile(user);
  } catch (error) {
    throw handleApiError(error, 'fetching user profile');
  }
};

// Update user profile
export const updateUserProfile = async (userData: Partial<UserModel>): Promise<UserModel> => {
  try {
    const payload = cleanUserUpdatePayload(userData);
    const response = await api.put(`${ENDPOINTS.USER}`, payload);
    return response.data as UserModel;
  } catch (error) {
    throw handleApiError(error, 'updating user profile');
  }
};

// Get current user ID from storage
export const getCurrentUserId = (): string | null => {
  return localStorage.getItem('userId');
};

// Get current user profile
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  const userId = getCurrentUserId();
  if (!userId) return null;

  try {
    return await getUserProfile(userId);
  } catch (error) {
    console.error('Failed to get current user profile:', error);
    return null;
  }
};

// Get current user
export const getCurrentUser = async (): Promise<UserModel | null> => {
  const userId = getCurrentUserId();
  if (!userId) return null;

  try {
    return await fetchUserById(userId);
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
};

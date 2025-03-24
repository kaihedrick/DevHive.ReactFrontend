import { api, handleApiError } from '../utils/apiClient';
import { ENDPOINTS } from '../config';
import { UserModel, UserProfile } from '../models/user.ts';

// Utility to sanitize update payload
const cleanUserUpdatePayload = (current: UserModel, updates: Partial<UserModel>): Partial<UserModel> => {
  const sanitized: Partial<UserModel> = { ID: current.ID };

  if (updates.Username && updates.Username !== current.Username) {
    sanitized.Username = updates.Username;
  }

  if (updates.Email && updates.Email !== current.Email) {
    sanitized.Email = updates.Email;
  }

  if (updates.FirstName && updates.FirstName !== current.FirstName) {
    sanitized.FirstName = updates.FirstName;
  }

  if (updates.LastName && updates.LastName !== current.LastName) {
    sanitized.LastName = updates.LastName;
  }

  if (updates.Password && updates.Password.trim() !== "") {
    sanitized.Password = updates.Password;
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

// Update this function to properly handle empty responses
export const updateUserProfile = async (
  userData: Partial<UserModel>,
  originalUser?: UserModel
): Promise<UserModel> => {
  try {
    const userId = userData.id || userData.ID;

    // If we have the original user data, make sure we only send changed fields
    let payload: Partial<UserModel>;

    if (originalUser) {
      payload = cleanUserUpdatePayload(originalUser, userData);
      console.log("Cleaned update payload:", payload);
    } else {
      payload = userData;
      console.log("Using raw update payload:", payload);
    }

    // ✅ Ensure the ID is always present for backend lookup
    if (!payload.ID && userId) {
      payload.ID = userId;
    }

    // Log final payload for debugging
    console.log("✅ Final PUT Payload:", payload);
    console.log("✅ PUT URL:", `${ENDPOINTS.USER}`);

    // Send the update to the backend
    const response = await api.put(`${ENDPOINTS.USER}`, payload);
    console.log("Profile update response:", response.status);

    // Return the updated user data if provided
    if (response.data && Object.keys(response.data).length > 0) {
      return response.data as UserModel;
    }

    // If 204 No Content, fetch latest data
    if (response.status === 204 && userId) {
      try {
        console.log("204 response - Fetching updated user data");
        return await fetchUserById(userId);
      } catch (fetchError) {
        console.error("Error fetching updated user after change:", fetchError);
      }
    }

    // Fallback: merge old and new data if needed
    if (response.status === 200 || response.status === 204) {
      if (originalUser) {
        const merged = { ...originalUser, ...userData };
        console.log("Creating merged user object:", merged);
        return merged as UserModel;
      }
      if (userData && userId) {
        return userData as UserModel;
      }
    }

    throw new Error("Unable to retrieve updated user data");
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw handleApiError(error, "updating user profile");
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
// Delete a user account 
export const deleteUserAccount = async (userId: string): Promise<boolean> => {
  try {
    await api.delete(`${ENDPOINTS.USER}/${userId}`);
    return true;
  } catch (error) {
    throw handleApiError(error, 'deleting user account');
  }
};
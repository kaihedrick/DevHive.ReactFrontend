import { api, handleApiError } from '../utils/apiClient';
import { ENDPOINTS } from '../config';
import { UserModel, UserProfile } from '../models/user.ts';

/**
 * @function cleanUserUpdatePayload
 * @description Sanitizes the user update payload to include only changed fields.
 * @param {UserModel} current - The original user data.
 * @param {Partial<UserModel>} updates - The incoming updates.
 * @returns {Partial<UserModel>} - A sanitized payload for update.
 */
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

/**
 * @function fetchUserById
 * @description Fetches a user object from the backend by user ID.
 * @param {string} userId - The ID of the user to fetch.
 * @returns {Promise<UserModel>} - A promise resolving to a UserModel object.
 */

export const fetchUserById = async (userId: string): Promise<UserModel> => {
  try {
    const response = await api.get(`${ENDPOINTS.USER}/${userId}`);
    return response.data as UserModel;
  } catch (error) {
    throw handleApiError(error, 'fetching user');
  }
};

/**
 * @function getUserProfile
 * @description Retrieves and transforms a user into a UserProfile object.
 * @param {string} userId - The ID of the user to fetch and wrap.
 * @returns {Promise<UserProfile>} - A promise resolving to a UserProfile instance.
 */
export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  try {
    const user = await fetchUserById(userId);
    return new UserProfile(user);
  } catch (error) {
    throw handleApiError(error, 'fetching user profile');
  }
};

/**
 * @function updateUserProfile
 * @description Updates user profile data and returns the updated model.
 * @param {Partial<UserModel>} userData - The fields to update.
 * @param {UserModel} [originalUser] - Original user data for differential updates.
 * @returns {Promise<UserModel>} - The updated user object.
 */
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


/**
 * @function getCurrentUserId
 * @description Retrieves the current user's ID from localStorage.
 * @returns {string | null} - The current user ID or null if not found.
 */

export const getCurrentUserId = (): string | null => {
  return localStorage.getItem('userId');
};

/**
 * @function getCurrentUserProfile
 * @description Fetches the UserProfile of the currently logged-in user.
 * @returns {Promise<UserProfile | null>} - A promise resolving to the current UserProfile or null.
 */
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

/**
 * @function getCurrentUser
 * @description Fetches the full UserModel of the currently logged-in user.
 * @returns {Promise<UserModel | null>} - A promise resolving to the current UserModel or null.
 */
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
/**
 * @function deleteUserAccount
 * @description Deletes a user account from the backend.
 * @param {string} userId - The ID of the user to delete.
 * @returns {Promise<boolean>} - True if successful, throws on failure.
 */
export const deleteUserAccount = async (userId: string): Promise<boolean> => {
  try {
    await api.delete(`${ENDPOINTS.USER}/${userId}`);
    return true;
  } catch (error) {
    throw handleApiError(error, 'deleting user account');
  }
};
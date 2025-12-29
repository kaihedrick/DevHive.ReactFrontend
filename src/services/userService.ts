import { api, handleApiError } from '../lib/apiClient.ts';
import { ENDPOINTS } from '../config';
import { UserModel, UserProfile } from '../models/user.ts';

/**
 * @function cleanUserUpdatePayload
 * @description Sanitizes the user update payload to include only changed fields in camelCase.
 * @param {UserModel} current - The original user data.
 * @param {Partial<UserModel>} updates - The incoming updates.
 * @returns {Partial<{username?: string; email?: string; firstName?: string; lastName?: string; password?: string}>} - A sanitized payload for update.
 */
const cleanUserUpdatePayload = (
  current: UserModel,
  updates: Partial<UserModel>
): Partial<{ username?: string; email?: string; firstName?: string; lastName?: string; password?: string }> => {
  const sanitized: Partial<{ username?: string; email?: string; firstName?: string; lastName?: string; password?: string }> = {};

  // Handle username (check both camelCase and PascalCase)
  const newUsername = updates.username || updates.Username;
  const currentUsername = current.username || current.Username;
  if (newUsername && newUsername !== currentUsername) {
    sanitized.username = newUsername;
  }

  // Handle email (check both camelCase and PascalCase)
  const newEmail = updates.email || updates.Email;
  const currentEmail = current.email || current.Email;
  if (newEmail && newEmail !== currentEmail) {
    sanitized.email = newEmail;
  }

  // Handle firstName (check both camelCase and PascalCase)
  const newFirstName = updates.firstName || updates.FirstName;
  const currentFirstName = current.firstName || current.FirstName;
  if (newFirstName && newFirstName !== currentFirstName) {
    sanitized.firstName = newFirstName;
  }

  // Handle lastName (check both camelCase and PascalCase)
  const newLastName = updates.lastName || updates.LastName;
  const currentLastName = current.lastName || current.LastName;
  if (newLastName && newLastName !== currentLastName) {
    sanitized.lastName = newLastName;
  }

  // Handle password (check both camelCase and PascalCase)
  const newPassword = updates.password || updates.Password;
  if (newPassword && newPassword.trim() !== "") {
    sanitized.password = newPassword;
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
    const response = await api.get(ENDPOINTS.USER_BY_ID(userId));
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
 * @description Updates current user profile data via PATCH /users/me and returns the updated model.
 * @param {Partial<UserModel>} userData - The fields to update (can be camelCase or PascalCase).
 * @param {UserModel} [originalUser] - Original user data for differential updates.
 * @returns {Promise<UserModel>} - The updated user object.
 */
export const updateUserProfile = async (
  userData: Partial<UserModel>,
  originalUser?: UserModel
): Promise<UserModel> => {
  try {
    // If we have the original user data, make sure we only send changed fields in camelCase
    let payload: Partial<{ username?: string; email?: string; firstName?: string; lastName?: string; password?: string }>;

    if (originalUser) {
      payload = cleanUserUpdatePayload(originalUser, userData);
      console.log("✅ Cleaned update payload (camelCase, changed fields only):", payload);
    } else {
      // Convert to camelCase if needed
      payload = {
        ...(userData.username || userData.Username ? { username: userData.username || userData.Username } : {}),
        ...(userData.email || userData.Email ? { email: userData.email || userData.Email } : {}),
        ...(userData.firstName || userData.FirstName ? { firstName: userData.firstName || userData.FirstName } : {}),
        ...(userData.lastName || userData.LastName ? { lastName: userData.lastName || userData.LastName } : {}),
        ...(userData.password || userData.Password ? { password: userData.password || userData.Password } : {}),
      };
      console.log("✅ Converted update payload (camelCase):", payload);
    }

    // Don't include id/ID - /users/me endpoint doesn't need it
    // Don't include empty payload
    if (Object.keys(payload).length === 0) {
      console.warn("⚠️ No fields to update");
      if (originalUser) {
        return originalUser;
      }
      throw new Error("No fields to update");
    }

    // Log final payload for debugging
    console.log("✅ Final PATCH Payload:", payload);
    console.log("✅ PATCH URL:", ENDPOINTS.USER_ME);

    // Send the update to the backend using /users/me endpoint
    const response = await api.patch(ENDPOINTS.USER_ME, payload);
    console.log("✅ Profile update response:", response.status);

    // Return the updated user data if provided
    if (response.data && Object.keys(response.data).length > 0) {
      return response.data as UserModel;
    }

    // If 204 No Content, fetch latest data using /users/me
    if (response.status === 204) {
      try {
        console.log("204 response - Fetching updated user data from /users/me");
        const meResponse = await api.get(ENDPOINTS.USER_ME);
        return meResponse.data as UserModel;
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
      if (userData) {
        return userData as UserModel;
      }
    }

    throw new Error("Unable to retrieve updated user data");
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
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
 * @function fetchCurrentUserFromMe
 * @description Fetches the current user from /users/me endpoint (single source of truth).
 * This uses the JWT token to get user data, not localStorage userId.
 * RECOMMENDED: Use this instead of getCurrentUser for user authentication state.
 * @returns {Promise<UserModel>} - A promise resolving to the current UserModel.
 */
export const fetchCurrentUserFromMe = async (): Promise<UserModel> => {
  try {
    const response = await api.get(ENDPOINTS.USER_ME);
    return response.data as UserModel;
  } catch (error) {
    throw handleApiError(error, 'fetching current user from /me');
  }
};

/**
 * @function getCurrentUser
 * @description Fetches the full UserModel of the currently logged-in user.
 * NOTE: This uses localStorage userId to fetch by ID, which can be stale.
 * RECOMMENDED: Use fetchCurrentUserFromMe() instead for single source of truth.
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
    await api.delete(ENDPOINTS.USER_BY_ID(userId));
    return true;
  } catch (error) {
    throw handleApiError(error, 'deleting user account');
  }
};
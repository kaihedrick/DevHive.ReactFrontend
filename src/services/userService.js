// UserService.js
// This module handles user-related API calls for DevHive user management.

import { api } from '../lib/apiClient.ts';
import { ENDPOINTS } from '../config';
import { sendWelcomeEmail } from './mailService';

/**
 * Creates a new user account.
 *
 * @param {Object} userData - Data for the new user
 * @param {string} userData.username - Username for the user
 * @param {string} userData.email - Email address for the user
 * @param {string} userData.password - Password for the user
 * @param {string} userData.firstName - First name of the user
 * @param {string} userData.lastName - Last name of the user
 * @returns {Promise<Object>} - The created user object
 * @throws {Error} - Throws an error if user creation fails
 */
export const createUser = async (userData) => {
    try {
        if (!userData.username || !userData.email || !userData.password || !userData.firstName || !userData.lastName) {
            throw new Error("Username, email, password, firstName, and lastName are required");
        }

        const payload = {
            username: userData.username,
            email: userData.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName
        };

        console.log("📤 Creating user:", { ...payload, password: '[REDACTED]' });

        const response = await api.post(ENDPOINTS.USERS, payload);

        console.log("✅ User created successfully:", response.data);

        // Send welcome email after successful registration
        try {
            const userName = `${userData.firstName} ${userData.lastName}`;
            await sendWelcomeEmail(userData.email, userName);
            console.log("✅ Welcome email sent successfully");
        } catch (emailError) {
            console.warn("⚠️ Failed to send welcome email:", emailError.message);
            // Don't throw error for email failure
        }

        return response.data;
    } catch (error) {
        console.error("❌ Error creating user:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Gets the current authenticated user's profile.
 *
 * @returns {Promise<Object>} - The current user's profile data
 * @throws {Error} - Throws an error if fetching user fails
 */
export const getCurrentUser = async () => {
    try {
        console.log("📡 Fetching current user profile");

        const response = await api.get(`${ENDPOINTS.USERS}/me`);

        console.log("✅ Current user fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching current user:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Fetches a user by their ID.
 *
 * @param {string} userId - The ID of the user to retrieve
 * @returns {Promise<Object>} - The user data object
 * @throws {Error} - Throws an error if the user cannot be retrieved
 */
export const fetchUserById = async (userId) => {
    try {
        if (!userId) {
            throw new Error("User ID is required");
        }

        console.log(`📡 Fetching user: ${userId}`);

        const response = await api.get(ENDPOINTS.USER_BY_ID(userId));

        console.log("✅ User fetched successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error fetching user:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Updates the current user's profile.
 *
 * @param {Object} userData - Updated user data
 * @param {string} [userData.firstName] - New first name
 * @param {string} [userData.lastName] - New last name
 * @param {string} [userData.email] - New email address
 * @param {string} [userData.avatarUrl] - New avatar URL
 * @returns {Promise<Object>} - The updated user object
 * @throws {Error} - Throws an error if user update fails
 */
export const updateCurrentUser = async (userData) => {
    try {
        const payload = {};
        if (userData.firstName !== undefined) payload.firstName = userData.firstName;
        if (userData.lastName !== undefined) payload.lastName = userData.lastName;
        if (userData.email !== undefined) payload.email = userData.email;
        if (userData.avatarUrl !== undefined) payload.avatarUrl = userData.avatarUrl;

        console.log("📤 Updating current user profile:", payload);

        const response = await api.patch(`${ENDPOINTS.USERS}/me`, payload);

        console.log("✅ User profile updated successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error updating user profile:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Changes the current user's password.
 *
 * @param {Object} passwordData - Password change data
 * @param {string} passwordData.currentPassword - Current password
 * @param {string} passwordData.newPassword - New password
 * @returns {Promise<Object>} - Confirmation response
 * @throws {Error} - Throws an error if password change fails
 */
export const changePassword = async (passwordData) => {
    try {
        if (!passwordData.currentPassword || !passwordData.newPassword) {
            throw new Error("Current password and new password are required");
        }

        const payload = {
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword
        };

        console.log("📤 Changing password");

        const response = await api.patch(`${ENDPOINTS.USERS}/me/password`, payload);

        console.log("✅ Password changed successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error changing password:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Deactivates the current user's account.
 *
 * @returns {Promise<Object>} - Confirmation response
 * @throws {Error} - Throws an error if account deactivation fails
 */
export const deactivateAccount = async () => {
    try {
        console.log("📤 Deactivating account");

        const response = await api.delete(`${ENDPOINTS.USERS}/me`);

        console.log("✅ Account deactivated successfully:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error deactivating account:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Searches for users by username or email.
 *
 * @param {string} query - Search query (username or email)
 * @returns {Promise<Array>} - Array of matching users
 * @throws {Error} - Throws an error if search fails
 */
export const searchUsers = async (query) => {
    try {
        if (!query || query.trim().length < 2) {
            throw new Error("Search query must be at least 2 characters long");
        }

        console.log(`📡 Searching users with query: ${query}`);

        const response = await api.get(`${ENDPOINTS.USERS}/search`, {
            params: { q: query.trim() }
        });

        console.log("✅ Users search completed:", response.data);
        return response.data;
    } catch (error) {
        console.error("❌ Error searching users:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Validates if an email address is available for registration.
 *
 * @param {string} email - Email address to validate
 * @returns {Promise<boolean>} - True if email is available, false otherwise
 * @throws {Error} - Throws an error if validation fails
 */
export const validateEmail = async (email) => {
    try {
        if (!email) {
            throw new Error("Email is required");
        }

        console.log(`📡 Validating email: ${email}`);

        const response = await api.get(`${ENDPOINTS.USERS}/validate-email`, {
            params: { email }
        });

        console.log("✅ Email validation completed:", response.data);
        return response.data.available || false;
    } catch (error) {
        console.error("❌ Error validating email:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Validates if a username is available for registration.
 *
 * @param {string} username - Username to validate
 * @returns {Promise<boolean>} - True if username is available, false otherwise
 * @throws {Error} - Throws an error if validation fails
 */
export const validateUsername = async (username) => {
    try {
        if (!username) {
            throw new Error("Username is required");
        }

        console.log(`📡 Validating username: ${username}`);

        const response = await api.get(`${ENDPOINTS.USERS}/validate-username`, {
            params: { username }
        });

        console.log("✅ Username validation completed:", response.data);
        return response.data.available || false;
    } catch (error) {
        console.error("❌ Error validating username:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Gets user initials for display purposes.
 *
 * @param {Object} user - User object
 * @param {string} user.firstName - User's first name
 * @param {string} user.lastName - User's last name
 * @returns {string} - User initials (e.g., "JD" for John Doe)
 */
export const getUserInitials = (user) => {
    if (!user || !user.firstName || !user.lastName) {
        return "??";
    }
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
};

/**
 * Gets user display name for UI purposes.
 *
 * @param {Object} user - User object
 * @param {string} user.firstName - User's first name
 * @param {string} user.lastName - User's last name
 * @param {string} user.username - User's username
 * @returns {string} - User display name
 */
export const getUserDisplayName = (user) => {
    if (!user) return "Unknown User";
    
    if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
    }
    
    return user.username || "Unknown User";
};

// Legacy functions for backward compatibility
export const register = async (userData) => {
    console.warn("⚠️ register is deprecated. Use createUser instead.");
    return createUser(userData);
};

const userService = {
    createUser,
    getCurrentUser,
    fetchUserById,
    updateCurrentUser,
    changePassword,
    deactivateAccount,
    searchUsers,
    validateEmail,
    validateUsername,
    getUserInitials,
    getUserDisplayName,
    // Legacy functions
    register
};

export default userService;
/**
 * @file storage.js
 * @description Utility functions and constants for managing application state in localStorage.
 */

/**
 * Enum-like object defining standardized keys used in localStorage.
 * @constant
 */
export const StorageKeys = {
  TOKEN: 'token',
  USER_ID: 'userId',
  SELECTED_PROJECT: 'selectedProjectId',
  THEME: 'theme',
  LANGUAGE: 'language',
};

/**
 * General localStorage utility object for CRUD operations.
 * Provides a consistent interface for reading and writing localStorage data.
 * @namespace
 */
export const storage = {
  /**
   * Retrieves a value by key from localStorage.
   * @param {string} key - The localStorage key.
   * @returns {string|null} - The value associated with the key, or null if not found.
   */
  get: (key) => localStorage.getItem(key),

  /**
   * Stores a key-value pair in localStorage.
   * @param {string} key - The localStorage key.
   * @param {string} value - The value to store.
   */
  set: (key, value) => localStorage.setItem(key, value),

  /**
   * Removes a specific key from localStorage.
   * @param {string} key - The localStorage key to remove.
   */
  remove: (key) => localStorage.removeItem(key),

  /**
   * Clears all keys from localStorage.
   */
  clear: () => localStorage.clear(),
};

/**
 * Project-specific localStorage operations.
 * Encapsulates logic for handling the selected project ID.
 * Scoped per user to avoid cross-account leakage.
 * @namespace
 */
export const projectStorage = {
  /**
   * Gets the storage key for selected project, scoped by userId
   * @param {string|null} userId - The current user ID (optional, will fetch from localStorage if not provided)
   * @returns {string} The storage key
   */
  getStorageKey: (userId = null) => {
    const currentUserId = userId || storage.get(StorageKeys.USER_ID);
    if (!currentUserId) {
      // Fallback to unscoped key for backward compatibility
      return StorageKeys.SELECTED_PROJECT;
    }
    return `${StorageKeys.SELECTED_PROJECT}:${currentUserId}`;
  },

  /**
   * Stores the selected project ID in localStorage, scoped by userId.
   * Dispatches 'project-changed' event for same-tab listeners only if value changed.
   * @param {string} projectId - The ID of the selected project.
   * @param {string|null} userId - The current user ID (optional)
   */
  setSelectedProject: (projectId, userId = null) => {
    const key = projectStorage.getStorageKey(userId);
    const currentValue = storage.get(key);

    // Only dispatch event if value actually changed (prevents duplicate events)
    if (currentValue !== projectId) {
      storage.set(key, projectId);
      // Dispatch event for same-tab listeners (storage event only fires cross-tab)
      window.dispatchEvent(new CustomEvent('project-changed', { detail: { projectId } }));
    } else {
      // Value unchanged - update storage but don't dispatch event
      storage.set(key, projectId);
    }
  },

  /**
   * Retrieves the selected project ID from localStorage, scoped by userId.
   * Falls back to legacy unscoped key for backward compatibility.
   * Task 4.1: Guard project reads - if userId === null, immediately return null
   * @param {string|null} userId - The current user ID (optional)
   * @returns {string|null} - The selected project ID, or null if not set or userId is null.
   */
  getSelectedProject: (userId = null) => {
    // Task 4.1: Guard - no project logic should run without identity
    const currentUserId = userId || storage.get(StorageKeys.USER_ID);
    if (!currentUserId) {
      return null;
    }

    const key = projectStorage.getStorageKey(currentUserId);
    let value = storage.get(key);

    // Fallback: If user-scoped key is empty, check legacy unscoped key
    if (!value) {
      const legacyValue = storage.get(StorageKeys.SELECTED_PROJECT);
      if (legacyValue) {
        // Migrate to user-scoped key
        projectStorage.setSelectedProject(legacyValue, currentUserId);
        // Clear legacy key
        storage.remove(StorageKeys.SELECTED_PROJECT);
        value = legacyValue;
      }
    }

    return value;
  },

  /**
   * Removes the selected project ID from localStorage, scoped by userId.
   * Dispatches 'project-changed' event for same-tab listeners only if value was set.
   * @param {string|null} userId - The current user ID (optional)
   */
  clearSelectedProject: (userId = null) => {
    const key = projectStorage.getStorageKey(userId);
    const currentValue = storage.get(key);

    storage.remove(key);
    // Also clear legacy unscoped key for backward compatibility
    storage.remove(StorageKeys.SELECTED_PROJECT);

    // Only dispatch event if value was actually set (prevents duplicate events)
    if (currentValue !== null) {
      // Dispatch event for same-tab listeners (storage event only fires cross-tab)
      window.dispatchEvent(new CustomEvent('project-changed', { detail: { projectId: null } }));
    }
  },

  /**
   * Clears selected project for all users (cleanup utility)
   */
  clearAllSelectedProjects: () => {
    // Clear all keys that start with selectedProjectId:
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(StorageKeys.SELECTED_PROJECT)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },
};

// Named exports for convenience in components or services
export const { 
  setSelectedProject, 
  getSelectedProject, 
  clearSelectedProject,
  clearAllSelectedProjects
} = projectStorage;

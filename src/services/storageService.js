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
 * @namespace
 */
export const projectStorage = {
  /**
   * Stores the selected project ID in localStorage.
   * @param {string} projectId - The ID of the selected project.
   */
  setSelectedProject: (projectId) => storage.set(StorageKeys.SELECTED_PROJECT, projectId),

  /**
   * Retrieves the selected project ID from localStorage.
   * @returns {string|null} - The selected project ID, or null if not set.
   */
  getSelectedProject: () => storage.get(StorageKeys.SELECTED_PROJECT),

  /**
   * Removes the selected project ID from localStorage.
   */
  clearSelectedProject: () => storage.remove(StorageKeys.SELECTED_PROJECT),
};

// Named exports for convenience in components or services
export const { 
  setSelectedProject, 
  getSelectedProject, 
  clearSelectedProject 
} = projectStorage;

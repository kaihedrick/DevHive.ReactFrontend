export const StorageKeys = {
  TOKEN: 'token',
  USER_ID: 'userId',
  SELECTED_PROJECT: 'selectedProjectId',
  THEME: 'theme',
  LANGUAGE: 'language'
};

export const storage = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear()
};

// Project specific storage functions
export const projectStorage = {
  setSelectedProject: (projectId) => storage.set(StorageKeys.SELECTED_PROJECT, projectId),
  getSelectedProject: () => storage.get(StorageKeys.SELECTED_PROJECT),
  clearSelectedProject: () => storage.remove(StorageKeys.SELECTED_PROJECT)
};

// Named exports
export const { setSelectedProject, getSelectedProject, clearSelectedProject } = projectStorage;

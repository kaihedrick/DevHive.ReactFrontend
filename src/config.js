//config.js
export const API_BASE_URL = "https://18.119.104.29:5001/api"; // Use HTTPS for all API calls
//export const API_BASE_URL = "http://18.119.104.29:5000/api"; // For production
export const ENDPOINTS = {
  USER: `${API_BASE_URL}/User`,
  PROJECT: `${API_BASE_URL}/Scrum/Project`,
  VALIDATE_EMAIL: `${API_BASE_URL}/User/ValidateEmail`,
  SPRINT: `${API_BASE_URL}/Scrum/Sprint`,
  TASK: `${API_BASE_URL}/Scrum/Task`,
  MEMBER: `${API_BASE_URL}/Scrum/Project/Members`,
  MESSAGE: `${API_BASE_URL}/Message`,
  UPDATE_PROJECT_OWNER: `${API_BASE_URL}/Scrum/Project/UpdateProjectOwner`
};

// StorageKeys enum
export const StorageKeys = {
  AUTH_TOKEN: 'token',
  USER_ID: 'userId',
  SELECTED_PROJECT: 'selectedProjectId'
};
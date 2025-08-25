//config.js
export const API_BASE_URL = "https://api.devhive.it.com/api"; // Use HTTPS for all API calls


// Add JWT config
export const JWT_CONFIG = {
  issuer: "https://api.devhive.it.com",
  audience: "https://d35scdhidypl44.cloudfront.net/",  // Your frontend domain
  audience: "devhive-clients"  // Your frontend domain
};

export const ENDPOINTS = {
  USER: `${API_BASE_URL}/User`,
  PROJECT: `${API_BASE_URL}/Scrum/Project`,
  VALIDATE_EMAIL: `${API_BASE_URL}/User/ValidateEmail`,
  SPRINT: `${API_BASE_URL}/Scrum/Sprint`,
  TASK: `${API_BASE_URL}/Scrum/Task`,
  MEMBER: `${API_BASE_URL}/Scrum/Project/Members`,
  MESSAGE: `${API_BASE_URL}/Message`,
  UPDATE_PROJECT_OWNER: `${API_BASE_URL}/Scrum/Project/UpdateProjectOwner`,
  PROJECT_USER: `${API_BASE_URL}/Scrum/Projects/User`
};

// StorageKeys enum
export const StorageKeys = {
  AUTH_TOKEN: 'token',
  USER_ID: 'userId',
  SELECTED_PROJECT: 'selectedProjectId'
};
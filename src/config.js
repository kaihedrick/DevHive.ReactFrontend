//config.js
export const API_BASE_URL = "https://localhost:7170/api";

export const ENDPOINTS = {
  USER: `${API_BASE_URL}/User`,
  PROJECT: `${API_BASE_URL}/Scrum/Project`,
  VALIDATE_EMAIL: `${API_BASE_URL}/User/ValidateEmail`,
  SPRINT: `${API_BASE_URL}/Scrum/Sprint`,
  TASK: `${API_BASE_URL}/Scrum/Task`,
  MEMBER: `${API_BASE_URL}/Scrum/Project/Members`,
  MESSAGE: `${API_BASE_URL}/Message`
};
// Add StorageKeys enum
export const StorageKeys = {
  AUTH_TOKEN: 'token',
  USER_ID: 'userId',
  SELECTED_PROJECT: 'selectedProjectId'
};
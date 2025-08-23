//config.js
export const API_BASE_URL = "https://api.devhive.it.com"; // Use HTTPS for all API calls
//export const API_BASE_URL = "http://18.119.104.29:5000/api"; // For production

// Add JWT config
export const JWT_CONFIG = {
  issuer: "https://api.devhive.it.com",
  audience: "https://d35scdhidypl44.cloudfront.net/"  // Your frontend domain
};

export const ENDPOINTS = {
  // User endpoints
  USER: `${API_BASE_URL}/User`,
  USER_BY_ID: (id) => `${API_BASE_URL}/User/${id}`,
  USER_BY_USERNAME: (username) => `${API_BASE_URL}/User/Username/${username}`,
  USER_PROCESS_LOGIN: `${API_BASE_URL}/User/ProcessLogin`,
  USER_VALIDATE_EMAIL: `${API_BASE_URL}/User/ValidateEmail`,
  USER_VALIDATE_USERNAME: `${API_BASE_URL}/User/ValidateUsername`,
  USER_REQUEST_PASSWORD_RESET: `${API_BASE_URL}/User/RequestPasswordReset`,
  USER_RESET_PASSWORD: `${API_BASE_URL}/User/ResetPassword`,
  
  // Project endpoints
  PROJECT: `${API_BASE_URL}/Scrum/Project`,
  PROJECT_BY_ID: (projectId) => `${API_BASE_URL}/Scrum/Project/${projectId}`,
  PROJECT_MEMBERS: (projectId) => `${API_BASE_URL}/Scrum/Project/Members/${projectId}`,
  PROJECT_TASKS: (projectId) => `${API_BASE_URL}/Scrum/Project/Tasks/${projectId}`,
  PROJECT_SPRINTS: (projectId) => `${API_BASE_URL}/Scrum/Project/Sprints/${projectId}`,
  PROJECT_ACTIVE_SPRINTS: (projectId) => `${API_BASE_URL}/Scrum/Project/Sprints/Active/${projectId}`,
  PROJECT_JOIN: (projectId, userId) => `${API_BASE_URL}/Scrum/Project/${projectId}/${userId}`,
  PROJECT_LEAVE: `${API_BASE_URL}/Scrum/Project/Leave`,
  PROJECT_UPDATE_OWNER: `${API_BASE_URL}/Scrum/Project/UpdateProjectOwner`,
  
  // Sprint endpoints
  SPRINT: `${API_BASE_URL}/Scrum/Sprint`,
  SPRINT_BY_ID: (sprintId) => `${API_BASE_URL}/Scrum/Sprint/${sprintId}`,
  SPRINT_TASKS: (sprintId) => `${API_BASE_URL}/Scrum/Sprint/Tasks/${sprintId}`,
  
  // Task endpoints
  TASK: `${API_BASE_URL}/Scrum/Task`,
  TASK_BY_ID: (taskId) => `${API_BASE_URL}/Scrum/Task/${taskId}`,
  TASK_STATUS: `${API_BASE_URL}/Scrum/Task/Status`,
  
  // Message endpoints
  MESSAGE: `${API_BASE_URL}/Message`,
  MESSAGE_SEND: `${API_BASE_URL}/Message/Send`,
  MESSAGE_RETRIEVE: (fromUserID, toUserID, projectID) => 
    `${API_BASE_URL}/Message/Retrieve/${fromUserID}/${toUserID}/${projectID}`,
  
  // User projects
  PROJECTS_BY_USER: (userId) => `${API_BASE_URL}/Scrum/Projects/User/${userId}`,
  
  // Database (if needed)
  DATABASE_EXECUTE_SCRIPT: `${API_BASE_URL}/Database/ExecuteScript`
};

// StorageKeys enum
export const StorageKeys = {
  AUTH_TOKEN: 'token',
  USER_ID: 'userId',
  SELECTED_PROJECT: 'selectedProjectId'
};
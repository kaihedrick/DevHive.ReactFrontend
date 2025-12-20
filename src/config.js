//config.js
// Get environment variable with fallback
const getApiBaseUrl = () => {
  try {
    // Check if we're in a Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_API_BASE_URL ?? 'https://devhive-go-backend.fly.dev/api/v1';
    }
    // Fallback for development
    return process.env.REACT_APP_API_BASE_URL ?? 'https://devhive-go-backend.fly.dev/api/v1';
  } catch (error) {
    // Fallback if environment variables are not available
    return 'https://devhive-go-backend.fly.dev/api/v1';
  }
};

export const API_BASE_URL = getApiBaseUrl(); // New Go backend with v1 API
//export const API_BASE_URL = "https://api.devhive.it.com/api"; // Legacy .NET backend (for gradual migration)

// Add JWT config
export const JWT_CONFIG = {
  issuer: "https://devhive-go-backend.fly.dev",
  audience: "devhive-clients"  // Your frontend domain
};

// New Go backend endpoints (v1 API)
export const ENDPOINTS = {
  // Auth endpoints
  AUTH_LOGIN: `${API_BASE_URL}/auth/login`,
  AUTH_REFRESH: `${API_BASE_URL}/auth/refresh`, // Currently returns 400 "not implemented"
  AUTH_PASSWORD_RESET_REQUEST: `${API_BASE_URL}/auth/password/reset-request`,
  AUTH_PASSWORD_RESET: `${API_BASE_URL}/auth/password/reset`,
  
  // User endpoints
  USERS: `${API_BASE_URL}/users`, // POST for registration
  USER_BY_ID: (id) => `${API_BASE_URL}/users/${id}`,
  USER_ME: `${API_BASE_URL}/users/me`,
  USER_VALIDATE_EMAIL: `${API_BASE_URL}/users/validate-email`, // GET/POST
  USER_VALIDATE_USERNAME: `${API_BASE_URL}/users/validate-username`, // GET/POST
  
  // Project endpoints
  PROJECTS: `${API_BASE_URL}/projects`, // GET/POST
  PROJECT_JOIN: `${API_BASE_URL}/projects/join`, // POST - join by project code
  PROJECT_BY_ID: (id) => `${API_BASE_URL}/projects/${id}`, // GET/PATCH/DELETE
  PROJECT_BUNDLE: (id) => `${API_BASE_URL}/projects/${id}/bundle`, // GET
  PROJECT_SPRINTS: (id) => `${API_BASE_URL}/projects/${id}/sprints`, // GET/POST
  PROJECT_TASKS: (id) => `${API_BASE_URL}/projects/${id}/tasks`, // GET/POST
  PROJECT_MESSAGES: (id) => `${API_BASE_URL}/projects/${id}/messages`, // GET/POST
  PROJECT_MEMBERS: (id) => `${API_BASE_URL}/projects/${id}/members`, // GET
  PROJECT_MEMBER: (projectId, userId) => `${API_BASE_URL}/projects/${projectId}/members/${userId}`, // PUT/DELETE
  PROJECT_INVITES: (id) => `${API_BASE_URL}/projects/${id}/invites`, // GET/POST
  PROJECT_INVITE: (projectId, inviteId) => `${API_BASE_URL}/projects/${projectId}/invites/${inviteId}`, // DELETE
  INVITE_BY_TOKEN: (token) => `${API_BASE_URL}/invites/${token}`, // GET (public)
  ACCEPT_INVITE: (token) => `${API_BASE_URL}/invites/${token}/accept`, // POST
  
  // Task endpoints
  TASKS: `${API_BASE_URL}/tasks`,
  TASK_BY_ID: (id) => `${API_BASE_URL}/tasks/${id}`, // GET/PATCH/DELETE
  TASK_STATUS: (id) => `${API_BASE_URL}/tasks/${id}/status`, // PATCH
  
  // Sprint endpoints
  SPRINTS: `${API_BASE_URL}/sprints`,
  SPRINT_STATUS: (id) => `${API_BASE_URL}/sprints/${id}/status`, // PATCH - update sprint status
  SPRINT_BY_ID: (id) => `${API_BASE_URL}/sprints/${id}`, // GET/PATCH/DELETE
  SPRINT_TASKS: (id) => `${API_BASE_URL}/sprints/${id}/tasks`, // GET
  
  // Message endpoints
  MESSAGES: `${API_BASE_URL}/messages`, // POST/GET
  // WebSocket URL - convert https:// to wss:// for WebSocket protocol
  MESSAGES_WS: API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/messages/ws',
  
  // Mail endpoints
  MAIL_SEND: `${API_BASE_URL}/mail/send`, // POST
  
  // Legacy endpoints (for gradual migration)
  LEGACY: {
    USER: `https://devhive-go-backend.fly.dev/api/User`,
    PROJECT: `https://devhive-go-backend.fly.dev/api/Scrum/Project`,
    VALIDATE_EMAIL: `https://devhive-go-backend.fly.dev/api/User/ValidateEmail`,
    SPRINT: `https://devhive-go-backend.fly.dev/api/Scrum/Sprint`,
    TASK: `https://devhive-go-backend.fly.dev/api/Scrum/Task`,
    MEMBER: `https://devhive-go-backend.fly.dev/api/Scrum/Project/Members`,
    MESSAGE: `https://devhive-go-backend.fly.dev/api/Message`,
    UPDATE_PROJECT_OWNER: `https://devhive-go-backend.fly.dev/api/Scrum/Project/UpdateProjectOwner`,
    PROJECT_USER: `https://devhive-go-backend.fly.dev/api/Scrum/Projects/User`
  }
};

// StorageKeys enum
export const StorageKeys = {
  AUTH_TOKEN: 'token',
  USER_ID: 'userId',
  SELECTED_PROJECT: 'selectedProjectId'
};
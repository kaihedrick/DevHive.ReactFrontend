//config.js
// Centralized API configuration
// Supports both Vite (import.meta.env) and Create React App (process.env) environments

/**
 * Get API base URL from environment variables with fallback
 * Priority: VITE_API_BASE_URL > REACT_APP_API_BASE_URL > default
 */
const getApiBaseUrl = () => {
  try {
    // Check if we're in a Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_API_BASE_URL ?? 'https://go.devhive.it.com/api/v1';
    }
    // Fallback for Create React App
    return process.env.REACT_APP_API_BASE_URL ?? 'https://go.devhive.it.com/api/v1';
  } catch (error) {
    // Fallback if environment variables are not available
    return 'https://go.devhive.it.com/api/v1';
  }
};

/**
 * Get WebSocket base URL from environment variables with fallback
 * Converts http/https to ws/wss automatically
 */
const getWsBaseUrl = () => {
  try {
    let wsUrl;
    // Check if we're in a Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      wsUrl = import.meta.env.VITE_WS_BASE_URL ?? import.meta.env.VITE_API_BASE_URL;
    } else {
      // Fallback for Create React App
      wsUrl = process.env.REACT_APP_WS_BASE_URL ?? process.env.REACT_APP_API_BASE_URL;
    }
    
    // If no WS URL specified, derive from API_BASE_URL
    if (!wsUrl) {
      const apiUrl = getApiBaseUrl();
      // Convert https:// to wss:// and http:// to ws://
      wsUrl = apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      // Remove /api/v1 suffix for WebSocket (WebSocket endpoint is at root level)
      wsUrl = wsUrl.replace('/api/v1', '');
    } else {
      // Ensure ws:// or wss:// protocol
      if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
        wsUrl = wsUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      }
    }
    
    return wsUrl;
  } catch (error) {
    // Fallback
    return 'wss://go.devhive.it.com';
  }
};

export const API_BASE_URL = getApiBaseUrl(); // New Go backend with v1 API
export const WS_BASE_URL = getWsBaseUrl(); // WebSocket base URL (wss://go.devhive.it.com)

// Log configuration at startup (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 API Configuration:', {
    API_BASE_URL,
    WS_BASE_URL,
    NODE_ENV: process.env.NODE_ENV
  });
}

// Add JWT config
export const JWT_CONFIG = {
  issuer: "https://go.devhive.it.com",
  audience: "devhive-clients"  // Your frontend domain
};

// New Go backend endpoints (v1 API)
export const ENDPOINTS = {
  // Auth endpoints
  AUTH_LOGIN: `${API_BASE_URL}/auth/login`,
  AUTH_REFRESH: `${API_BASE_URL}/auth/refresh`,
  AUTH_LOGOUT: `${API_BASE_URL}/auth/logout`,
  AUTH_PASSWORD_RESET_REQUEST: `${API_BASE_URL}/auth/password/reset-request`,
  AUTH_PASSWORD_RESET: `${API_BASE_URL}/auth/password/reset`,
  // Google OAuth endpoints
  AUTH_GOOGLE_LOGIN: `${API_BASE_URL}/auth/google/login`,
  AUTH_GOOGLE_CALLBACK: `${API_BASE_URL}/auth/google/callback`,
  
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
    USER: `https://go.devhive.it.com/api/User`,
    PROJECT: `https://go.devhive.it.com/api/Scrum/Project`,
    VALIDATE_EMAIL: `https://go.devhive.it.com/api/User/ValidateEmail`,
    SPRINT: `https://go.devhive.it.com/api/Scrum/Sprint`,
    TASK: `https://go.devhive.it.com/api/Scrum/Task`,
    MEMBER: `https://go.devhive.it.com/api/Scrum/Project/Members`,
    MESSAGE: `https://go.devhive.it.com/api/Message`,
    UPDATE_PROJECT_OWNER: `https://go.devhive.it.com/api/Scrum/Project/UpdateProjectOwner`,
    PROJECT_USER: `https://go.devhive.it.com/api/Scrum/Projects/User`
  }
};

// StorageKeys enum
export const StorageKeys = {
  AUTH_TOKEN: 'token',
  USER_ID: 'userId',
  SELECTED_PROJECT: 'selectedProjectId'
};
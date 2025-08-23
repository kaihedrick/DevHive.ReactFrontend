import axios from "axios";
import { API_BASE_URL } from "../config";
import { getAuthToken, storeAuthData } from "../services/authService";
import { ENDPOINTS } from '../config';
/**
 * @constant api
 * @description Axios instance with a base URL and auth token interceptor for authenticated requests.
 */
export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use(config => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const API_URL = `${API_BASE_URL}/User`;

/**
 * @function login
 * @description Authenticates a user and stores the JWT token and user ID on successful login.
 * @param {Object} credentials - The user's login credentials.
 * @returns {Promise<Object>} - The response data containing user and token info.
 */
export const login = async (credentials) => {
  try {
    const response = await axios.post(`${API_URL}/ProcessLogin/`, credentials);
    const { token, userId } = response.data;

    if (token && userId) {
      storeAuthData(token, userId);
      console.log("Login successful. Token and user ID stored.");
    } else {
      console.error("Login response did not include necessary credentials.");
    }

    return response.data;
  } catch (error) {
    console.error("Error during login:", error.response?.data || error.message);
    throw error;
  }
};
/**
 * @function register
 * @description Registers a new user by sending user data to the backend.
 * @param {Object} userData - The new user's registration data.
 * @returns {Promise<Object>} - The response data from the registration API.
 */
export const register = async (userData) => {
  const response = await axios.post(API_URL, userData);
  return response.data;
};
/**
 * @function validateEmail
 * @description Validates if an email address is already in use.
 * @param {string} email - The email address to validate.
 * @returns {Promise<Object>} - The response indicating whether the email is unique.
 */
export const validateEmail = async (email) => {
  try {
    const response = await axios.post(`${API_URL}/ValidateEmail`, { email });
    return response.data;
  } catch (error) {
    console.error("Error checking email duplicate:", error.response?.data || error.message);
    throw error;
  }
};
/**
 * @function fetchUserById
 * @description Retrieves user details by user ID using an authenticated request.
 * @param {string} userId - The ID of the user to fetch.
 * @returns {Promise<Object>} - The user object retrieved from the API.
 */
export const fetchUserById = async (userId) => {
  try {
    const response = await api.get(ENDPOINTS.USER_BY_ID(userId));
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    throw error;
  }
};

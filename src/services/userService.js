import axios from "axios";
import { API_BASE_URL } from "../config";
import { getAuthToken, storeAuthData } from "../services/authService";
import { ENDPOINTS } from '../config';

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

// Login function to authenticate the user and store token & user ID
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

export const register = async (userData) => {
  const response = await axios.post(API_URL, userData);
  return response.data;
};

export const validateEmail = async (email) => {
  try {
    const response = await axios.post(`${API_URL}/ValidateEmail`, { email });
    return response.data;
  } catch (error) {
    console.error("Error checking email duplicate:", error.response?.data || error.message);
    throw error;
  }
};

export const fetchUserById = async (userId) => {
  try {
    const response = await api.get(`${ENDPOINTS.USER}/${userId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    throw error;
  }
};

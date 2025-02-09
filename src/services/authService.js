import axios from "axios";
import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/User`;

// ✅ Get authentication token from localStorage
export const getAuthToken = () => localStorage.getItem("token");

// ✅ Get user ID from localStorage
export const getUserId = () => {
  return localStorage.getItem("userId");
};

// ✅ Store token & user ID in localStorage
export const storeAuthData = (token, userId) => {
  localStorage.setItem("token", token);
  localStorage.setItem("userId", userId);
};

// ✅ Clear authentication data
export const clearAuthData = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
};

// ✅ Validate email (check if it's already in use)
export const validateEmail = async (email) => {
  try {
    const response = await axios.post(`${API_URL}/ValidateEmail`, { email });
    return response.data;
  } catch (error) {
    console.error("❌ Error checking email duplicate:", error.response?.data || error.message);
    throw error;
  }
};

// ✅ Login function
export const login = async (credentials) => {
  try {
    const response = await axios.post(`${API_URL}/ProcessLogin/`, credentials);
    const { token, userId } = response.data;

    if (token && userId) {
      storeAuthData(token, userId);
      console.log("✅ Login successful. Token and user ID stored.");
    } else {
      console.error("❌ Login response did not include necessary credentials.");
    }

    return response.data;
  } catch (error) {
    console.error("❌ Error during login:", error.response?.data || error.message);
    throw error;
  }
};

// ✅ Register function
export const register = async (userData) => {
  try {
    const response = await axios.post(`${API_URL}/`, userData);
    return response.data;
  } catch (error) {
    console.error("❌ Error during registration:", error.response?.data || error.message);
    throw error;
  }
};

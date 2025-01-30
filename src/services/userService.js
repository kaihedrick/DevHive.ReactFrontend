import axios from "axios";

const API_BASE_URL = "https://localhost:7170/api";

// Function to get JWT token from localStorage
export const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Function to fetch user by ID
export const fetchUserById = async (userId) => {
  try {
    const token = getAuthToken();
    console.log("Fetching user details for ID:", userId);

    const response = await axios.get(`${API_BASE_URL}/User/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("User Data:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching user by ID:", error.response?.data || error.message);
    throw error;
  }
};

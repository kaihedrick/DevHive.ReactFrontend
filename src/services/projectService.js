import axios from "axios";

const API_BASE_URL = "https://localhost:7170/api";

// Fetch projects by user ID
export const fetchUserProjects = async (userId) => {
  try {
    const token = localStorage.getItem("token"); // Retrieve JWT token from storage
    const response = await axios.get(`${API_BASE_URL}/Scrum/Projects/User/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching user projects:", error.response?.data || error.message);
    throw error;
  }
};

// Fetch a specific project by ID
export const fetchProjectById = async (projectId) => {
  try {
    const token = localStorage.getItem("token");
    const response = await axios.get(`${API_BASE_URL}/Scrum/Project/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching project by ID:", error.response?.data || error.message);
    throw error;
  }
};

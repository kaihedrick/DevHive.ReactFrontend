import axios from "axios";

const API_BASE_URL = "https://localhost:7170/api";

// Function to fetch projects by user ID
export const fetchUserProjects = async () => {
  try {
    const token = getAuthToken();  // Get JWT token from helper function
    const userId = getUserId(); // Get user ID from localStorage

    if (!userId) {
      console.error("Error: User ID is missing. Please log in again.");
      throw new Error("User ID is missing. Please log in again.");
    }

    const response = await axios.get(`${API_BASE_URL}/Scrum/Projects/User/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching user projects:", error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch a specific project by ID
export const fetchProjectById = async (projectId) => {
  try {
    const token = getAuthToken();
    console.log("Fetching project with ID:", projectId);
    
    const response = await axios.get(`${API_BASE_URL}/Scrum/Project/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("Project Data:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching project by ID:", error.response?.data || error.message);
    throw error;
  }
};
// Get all project members by project id
export const fetchProjectMembers = async (projectId) => {
  try {
    const token = getAuthToken();
    console.log("Fetching members for project:", projectId);
    
    const response = await axios.get(`${API_BASE_URL}/Scrum/Project/Members/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("Project Members:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching project members:", error.response?.data || error.message);
    throw error;
  }
};

// Function to store selected project ID in localStorage
export const setSelectedProject = (projectId) => {
  localStorage.setItem("selectedProjectId", projectId);
};

// Function to get selected project ID from localStorage
export const getSelectedProject = () => {
  return localStorage.getItem("selectedProjectId");
};

// Function to remove the selected project ID from localStorage
export const clearSelectedProject = () => {
  localStorage.removeItem("selectedProjectId");
};

// Function to get JWT token from localStorage
export const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Function to get stored user ID safely
export const getUserId = () => {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    console.warn("Warning: User ID not found in localStorage.");
  }
  return userId;
};
// Function to create a new project
export const createProject = async (projectName, projectDescription) => {
  try {
    const token = getAuthToken();
    const projectOwnerId = getUserId();  // Ensure the project owner ID is used

    if (!projectOwnerId) {
      console.error("Error: Project Owner ID is missing. Please log in again.");
      throw new Error("Project Owner ID is missing. Please log in again.");
    }

    const projectData = {
      name: projectName,
      description: projectDescription,
      projectOwnerID: projectOwnerId,
    };

    const response = await axios.post(`${API_BASE_URL}/Scrum/Project/`, projectData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error creating project:", error.response?.data || error.message);
    throw error;
  }
};
// Function to join a project using projectId and userId

export const joinProject = async (projectId, userId) => {
  try {
    const token = getAuthToken(); // Retrieve JWT token for authorization

    if (!projectId || !userId) {
      throw new Error("Project ID or User ID is missing.");
    }

    const response = await axios.post(
      `${API_BASE_URL}/Project/${projectId}/${userId}`, // URL structure matches the backend
      {}, // No request body needed
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Successfully joined project:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error joining project:", error.response?.data || error.message);
    throw error;
  }
};

export const editProject = async (project) => {
  try {
    const token = getAuthToken();

    if (!project || !project.id) {
      throw new Error("Project data is invalid or missing.");
    }

    // ✅ Corrected API URL (No {id} in URL, as ID is in request body)
    const apiUrl = `${API_BASE_URL}/Scrum/Project`;

    console.log("🔄 Sending update request to:", apiUrl);
    console.log("📤 Payload:", project);

    const response = await axios.put(apiUrl, project, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("📩 Server Response:", response.data);

    if (response.status !== 200) {
      throw new Error(`Unexpected response status: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    console.error("❌ Error updating project:", {
      message: error.message,
      responseData: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
    });

    throw error;
  }
};

export const removeMemberFromProject = async (projectId, userId) => {
  try {
    const token = getAuthToken();

    if (!projectId || !userId) {
      throw new Error("❌ Project ID or User ID is missing.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Project/${projectId}/Members/${userId}`;

    console.log("🔍 API URL Check:", apiUrl);
    console.log("📌 projectId:", projectId);
    console.log("📌 userId:", userId);

    const response = await axios.delete(apiUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`✅ Successfully removed user ${userId} from project ${projectId}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error removing member:", error.response?.data || error.message);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    const token = getAuthToken();

    if (!projectId) {
      throw new Error("❌ Project ID is missing.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Project/${projectId}`;
    console.log("🚀 Sending DELETE request to:", apiUrl);

    const response = await axios.delete(apiUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`✅ Successfully deleted project ${projectId}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error deleting project:", {
      message: error.message,
      responseData: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
    });

    throw error;
  }
};


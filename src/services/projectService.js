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

//function to explicity check to see if a user is project owner or not: 
export const isProjectOwner = async (projectId) => {
  try {
    const project = await fetchProjectById(projectId);
    const currentUserId = getUserId();

    return project.projectOwnerID === currentUserId; // ✅ Returns true if user is the owner
  } catch (error) {
    console.error("❌ Error checking project ownership:", error);
    return false; // Default to false on error
  }
};

// Get all project members by project id
export const fetchProjectMembers = async (projectId) => {
  try {
    const token = getAuthToken();
    if (!projectId) throw new Error("❌ Project ID is required.");

    const apiUrl = `${API_BASE_URL}/Scrum/Project/Members/${projectId}`;
    console.log("🔄 Fetching project members from:", apiUrl);

    const response = await axios.get(apiUrl, { headers: { Authorization: `Bearer ${token}` } });

    console.log("✅ Members Data:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching project members:", error.response?.data || error.message);
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

    const apiUrl = `${API_BASE_URL}/Scrum/Project/${projectId}/${userId}`; // ✅ Correct URL structure

    console.log(`🚀 Sending POST request to: ${apiUrl}`);

    const response = await axios.post(apiUrl, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Successfully joined project:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error joining project:", error.response?.data || error.message);
    throw error;
  }
};




// Function to edit a project (Only for project owner)
export const editProject = async (project) => {
  try {
    const token = getAuthToken();

    if (!project || !project.id) {
      throw new Error("Project data is invalid or missing.");
    }

    const isOwner = await isProjectOwner(project.id);
    if (!isOwner) {
      throw new Error("❌ You are not the project owner. Editing is not allowed.");
    }

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
    console.error("❌ Error updating project:", error);
    throw error;
  }
};

// Function to remove a member from a project (Only for project owner)
export const removeMemberFromProject = async (projectId, userId) => {
  try {
    const token = getAuthToken();

    if (!projectId || !userId) {
      throw new Error("❌ Project ID or User ID is missing.");
    }

    const isOwner = await isProjectOwner(projectId);
    if (!isOwner) {
      throw new Error("❌ You are not the project owner. You cannot remove members.");
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

// Function to delete a project (Only for project owner)
export const deleteProject = async (projectId) => {
  try {
    const token = getAuthToken();

    if (!projectId) {
      throw new Error("❌ Project ID is missing.");
    }

    const isOwner = await isProjectOwner(projectId);
    if (!isOwner) {
      throw new Error("❌ You are not the project owner. Deletion is not allowed.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Project/${projectId}`;
    console.log("🚀 Sending DELETE request to:", apiUrl);

    const response = await axios.delete(apiUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`✅ Successfully deleted project ${projectId}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error deleting project:", error);
    throw error;
  }
};
//======================================End of Project Service===========================================//

//===================================Beginning of Sprint Service=========================================//
// Function to create a new sprint for a project
export const createSprint = async (sprintData) => {
  try {
    const token = getAuthToken();

    if (!sprintData || !sprintData.projectID) {
      throw new Error("❌ Sprint data is missing or project ID is not provided.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Sprint/`;

    console.log("🚀 Sending POST request to create sprint:", apiUrl);
    console.log("📤 Sprint Payload:", sprintData);

    const response = await axios.post(apiUrl, sprintData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Sprint successfully created:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error creating sprint:", error.response?.data || error.message);
    throw error;
  }
};

// Function to create a new task in a sprint
export const createTask = async (taskData) => {
  try {
    const token = getAuthToken();

    if (!taskData || !taskData.sprintID) {
      throw new Error("❌ Task data is missing or Sprint ID is not provided.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Task/`;

    console.log("🚀 Sending POST request to create task:", apiUrl);
    console.log("📤 Task Payload:", taskData);

    const response = await axios.post(apiUrl, taskData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Task successfully created:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error creating task:", error.response?.data || error.message);
    throw error;
  }
};

// Function to edit/update an existing sprint
export const editSprint = async (sprintData) => {
  try {
    const token = getAuthToken();

    if (!sprintData || !sprintData.id) {
      throw new Error("❌ Sprint data is missing or Sprint ID is not provided.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Sprint/`; 

    console.log("🚀 Sending PUT request to update sprint:", apiUrl);
    console.log("📤 Sprint Payload:", sprintData);

    const response = await axios.put(apiUrl, sprintData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Sprint successfully updated:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error updating sprint:", error.response?.data || error.message);
    throw error;
  }
};
// Function to edit/update an existing task
export const editTask = async (taskData) => {
  try {
    const token = getAuthToken();

    if (!taskData || !taskData.id) {
      throw new Error("❌ Task data is missing or Task ID is not provided.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Task/`; 

    console.log("🚀 Sending PUT request to update task:", apiUrl);
    console.log("📤 Task Payload:", taskData);

    const response = await axios.put(apiUrl, taskData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Task successfully updated:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error updating task:", error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch all tasks for a given sprint
export const fetchSprintTasks = async (sprintId) => {
  try {
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Sprint/Tasks/${sprintId}`; // ✅ Correct API endpoint

    console.log("🚀 Fetching tasks for sprint:", sprintId);

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("✅ Retrieved sprint tasks:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching sprint tasks:", error.response?.data || error.message);
    throw error;
  }
};
// Function to fetch all tasks for a given project
export const fetchProjectTasks = async (projectId) => {
  try {
    const token = getAuthToken();

    if (!projectId) {
      throw new Error("❌ Project ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Project/Tasks/${projectId}`; // ✅ Correct API endpoint

    console.log("🚀 Fetching tasks for project:", projectId);

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("✅ Retrieved project tasks:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching project tasks:", error.response?.data || error.message);
    throw error;
  }
};
// Function to fetch all sprints for a given project
export const fetchProjectSprints = async (projectId) => {
  try {
    const token = getAuthToken();

    if (!projectId) {
      throw new Error("❌ Project ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Project/Sprints/${projectId}`; // ✅ Correct API endpoint

    console.log("🚀 Fetching sprints for project:", projectId);

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("✅ Retrieved project sprints:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching project sprints:", error.response?.data || error.message);
    throw error;
  }
};
// Function to fetch a single sprint by its ID
export const fetchSprintById = async (sprintId) => {
  try {
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Sprint/${sprintId}`; // ✅ Correct API endpoint

    console.log("🚀 Fetching sprint details for:", sprintId);

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("✅ Retrieved sprint details:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching sprint:", error.response?.data || error.message);
    throw error;
  }
};
// Function to fetch a single task by its ID
export const fetchTaskById = async (taskId) => {
  try {
    const token = getAuthToken();

    if (!taskId) {
      throw new Error("❌ Task ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Task/${taskId}`; // ✅ Correct API endpoint

    console.log("🚀 Fetching task details for:", taskId);

    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("✅ Retrieved task details:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching task:", error.response?.data || error.message);
    throw error;
  }
};
// Function to delete a task by its ID
export const deleteTask = async (taskId) => {
  try {
    const token = getAuthToken();

    if (!taskId) {
      throw new Error("❌ Task ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Task/${taskId}`; // ✅ Correct API endpoint

    console.log("🚀 Sending DELETE request for task:", taskId);

    const response = await axios.delete(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`✅ Successfully deleted task: ${taskId}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error deleting task:", error.response?.data || error.message);
    throw error;
  }
};
// Function to delete a sprint by its ID
export const deleteSprint = async (sprintId) => {
  try {
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Sprint/${sprintId}`; // ✅ Correct API endpoint

    console.log("🚀 Sending DELETE request for sprint:", sprintId);

    const response = await axios.delete(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`✅ Successfully deleted sprint: ${sprintId}`);
    return response.data;
  } catch (error) {
    console.error("❌ Error deleting sprint:", error.response?.data || error.message);
    throw error;
  }
};

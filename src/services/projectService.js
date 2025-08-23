import axios from "axios";
import { fetchUserById } from "./userService"; 
import { api, handleApiError, createAuthenticatedRequest } from '../utils/apiClient';
import { ENDPOINTS, API_BASE_URL } from '../config';
import { StorageKeys } from '../config';

/**
 * Fetches all projects associated with the currently authenticated user.
 *
 * @returns {Promise<Array>} - A list of project objects.
 * 
 * @throws {Error} - If the user ID is not found or the API call fails.
 *
 * @example
 * const projects = await fetchUserProjects();
 */

// In projectService.js
export const fetchUserProjects = async () => {
  try {
    const userId = getUserId();

    if (!userId) {
      console.error("❌ No user ID found. Please log in again.");
      throw new Error("User ID is missing. Please log in again.");
    }

    console.log(`📡 Fetching projects for user: ${userId}`);
    
    // Check the token before making the API call
    const token = getAuthToken();
    if (!token) {
      console.error("❌ No auth token found. Please log in again.");
      throw new Error("Authentication token is missing. Please log in again.");
    }
    
    // DEBUGGING: Log the FULL token (remove in production) to verify its format
    console.log("🔑 FULL TOKEN:", token);
    console.log("🔑 TOKEN LENGTH:", token.length);
    // Check if token already includes "Bearer" prefix
    if (token.startsWith("Bearer ")) {
      console.warn("⚠️ Token already includes 'Bearer' prefix!");
    }

    console.log(`📡 Full API URL: ${ENDPOINTS.PROJECTS_BY_USER(userId)}`);

    // Make direct axios call with explicit headers
    const response = await axios.get(ENDPOINTS.PROJECTS_BY_USER(userId), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      // Add timeout and additional options for better diagnostics
      timeout: 10000, // 10 seconds
      validateStatus: status => status < 500 // Don't throw on 4xx errors
    });

    console.log("✅ Projects fetched:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching user projects:", error.response?.data || error.message);
    
    // More detailed error information
    if (error.response) {
      console.error("📊 Status:", error.response.status);
      console.error("📄 Headers:", JSON.stringify(error.response.headers, null, 2));
      console.error("📝 Data:", error.response.data);
      
      if (error.response.status === 401) {
        console.error("🔒 Authentication failed. Token may be invalid or expired.");
        // Clear invalid token and redirect to login
        localStorage.removeItem(StorageKeys.AUTH_TOKEN);
        localStorage.removeItem(StorageKeys.USER_ID);
        window.location.href = "/";
      }
    }
    
    throw handleApiError(error, 'fetching user projects');
  }
};

/**
 * Fetches a single project by its ID.
 *
 * @param {string} projectId - The ID of the project to retrieve.
 * @returns {Promise<Object>} - The project data object.
 * 
 * @throws {Error} - If the project cannot be retrieved.
 *
 * @example
 * const project = await fetchProjectById("project123");
 */

export const fetchProjectById = async (projectId) => {
  try {
    const response = await api.get(ENDPOINTS.PROJECT_BY_ID(projectId));
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching project:', error);
    throw error;
  }
};

/**
 * Checks whether the currently logged-in user is the owner of the specified project.
 *
 * @param {string} projectId - The ID of the project to check.
 * @returns {Promise<boolean>} - True if the user is the project owner, false otherwise.
 *
 * @example
 * const isOwner = await isProjectOwner("project123");
 */

export const isProjectOwner = async (projectId) => {
  try {
    const project = await fetchProjectById(projectId);
    const currentUserId = getUserId();

    return project.projectOwnerID === currentUserId; // Returns true if user is the owner
  } catch (error) {
    console.error("❌ Error checking project ownership:", error);
    return false; // Default to false on error
  }
};

/**
 * Fetches all members associated with a specific project.
 *
 * @param {string} projectId - The ID of the project whose members should be retrieved.
 * @returns {Promise<Array>} - A list of member objects.
 *
 * @throws {Error} - If the request fails.
 *
 * @example
 * const members = await fetchProjectMembers("project123");
 */

export const fetchProjectMembers = async (projectId) => {
  try {
    const response = await api.get(ENDPOINTS.PROJECT_MEMBERS(projectId));
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching project members:', error);
    throw error;
  }
};

/**
 * Stores the selected project ID in localStorage for state persistence.
 *
 * @param {string} projectId - The project ID to be saved.
 *
 * @example
 * setSelectedProject("project123");
 */

export const setSelectedProject = (projectId) => {
  localStorage.setItem(StorageKeys.SELECTED_PROJECT, projectId);
};
/**
 * Sets the currently selected project ID for the session.
 *
 * @param {string} projectId - The ID of the project to select.
 * @returns {boolean} - Returns true if the project was successfully selected, false otherwise.
 *
 * @example
 * const success = await selectProject("project123");
 */

export const selectProject = async (projectId) => {
  try {
    setSelectedProject(projectId);
    return true;
  } catch (error) {
    console.error("❌ Error selecting project:", error);
    return false;
  }
};

/**
 * Retrieves the currently selected project ID from localStorage.
 *
 * @returns {string|null} - The stored project ID or null if not found.
 *
 * @example
 * const projectId = getSelectedProject();
 */

export const getSelectedProject = () => {
  try {
    return localStorage.getItem(StorageKeys.SELECTED_PROJECT);
  } catch (error) {
    console.error('Error getting selected project:', error);
    return null;
  }
};

/**
 * Removes the selected project ID from localStorage.
 *
 * @example
 * clearSelectedProject();
 */

export const clearSelectedProject = () => {
  localStorage.removeItem(StorageKeys.SELECTED_PROJECT);
};

/**
 * Retrieves the stored authentication token from localStorage.
 *
 * @returns {string|null} - JWT token or null if not found.
 *
 * @example
 * const token = getAuthToken();
 */

export const getAuthToken = () => {
  return localStorage.getItem(StorageKeys.AUTH_TOKEN);
};

/**
 * Retrieves the current user ID from localStorage.
 *
 * @returns {string|null} - The user ID or null if not found.
 * Logs a warning if the user ID is missing.
 *
 * @example
 * const userId = getUserId();
 */
export const getUserId = () => {
  const userId = localStorage.getItem(StorageKeys.USER_ID);
  if (!userId) {
    console.warn("Warning: User ID not found in localStorage.");
  }
  return userId;
};
/**
 * Creates a new project in the system.
 *
 * @param {Object} projectData - Data for the new project.
 * @param {string} projectData.name - Name of the project.
 * @param {string} projectData.projectOwnerID - ID of the project owner.
 * @param {string} [projectData.description] - Optional description of the project.
 * @returns {Promise<Object>} - The created project object from the backend.
 *
 * @throws Will throw an error if required fields are missing or the API request fails.
 */

export const createProject = async (projectData) => {
  try {
    const token = getAuthToken();
    
    if (!projectData.name || !projectData.projectOwnerID) {
      throw new Error("Project name and owner ID are required");
    }
    
    // Create a proper project object matching the backend model
    const project = {
      id: "", // This will be generated by the backend
      name: projectData.name,
      description: projectData.description || "",
      projectOwnerID: projectData.projectOwnerID
    };
    
    console.log("Creating project:", project);
    
    const response = await axios.post(`${API_BASE_URL}/Scrum/Project/`, project, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    
    console.log("Project created successfully:", response);
    return response.data;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
};
/**
 * Joins an existing project as a team member.
 *
 * @param {string} projectId - ID of the project to join.
 * @param {string} userId - ID of the user joining the project.
 * @returns {Promise<Object>} - Confirmation data from the backend.
 *
 * @throws Will throw an error if parameters are missing or the API request fails.
 */

export const joinProject = async (projectId, userId) => {
  try {
    const token = getAuthToken(); // Retrieve JWT token for authorization

    if (!projectId || !userId) {
      throw new Error("Project ID or User ID is missing.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Project/${projectId}/${userId}`; 

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

/**
 * Leaves the specified project as the current user.
 *
 * @param {string} projectId - ID of the project to leave.
 * @returns {Promise<Object>} - Confirmation response from the API.
 *
 * @throws Will throw an error if user or project ID is missing, or if the API call fails.
 *         If the user is the project owner, an additional validation message is returned.
 */

export const leaveProject = async (projectId) => {
  try {
    const token = getAuthToken();
    const userId = getUserId();

    if (!projectId || !userId) {
      throw new Error("❌ Project ID or User ID is missing.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Project/Leave`; // Corrected URL to match the format

    console.log("🚀 Sending request to leave project:", projectId);
    console.log("📤 Payload:", { ProjectID: projectId, UserID: userId });

    const response = await axios.post(
      apiUrl,
      { ProjectID: projectId, UserID: userId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Successfully left project:", response.data);

    // Clear selected project since we've left it
    clearSelectedProject();

    return response.data;
  } catch (error) {
    console.error("❌ Error leaving project:", error.response?.data || error.message);

    // Check for specific error message from backend indicating user is project owner
    if (
      error.response?.data &&
      typeof error.response.data === "string" &&
      error.response.data.includes("project owner")
    ) {
      throw new Error("You are the project owner. Please reassign ownership before leaving the project.");
    }

    throw new Error(error.response?.data || "Failed to leave the project.");
  }
};

/**
 * Updates an existing project's details. Only the project owner can perform this action.
 *
 * @param {Object} project - The project object to update.
 * @param {string} project.id - Unique identifier of the project to be edited.
 * @param {string} [project.name] - New name for the project.
 * @param {string} [project.description] - Optional updated description.
 * @param {string} [project.projectOwnerID] - ID of the current or new project owner.
 * @returns {Promise<Object>} - The updated project object returned from the backend.
 *
 * @throws Will throw an error if the user is not the project owner, if required fields are missing,
 *         or if the update operation fails.
 */
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

/**
 * Update the project owner.
 * @param {string} projectId - The ID of the project.
 * @param {string} newOwnerId - The ID of the new project owner.
 * @returns {Promise<string>} - Success message from the API.
 */
export const updateProjectOwner = async (projectId, newOwnerId) => {
  try {
    const token = getAuthToken();

    if (!projectId || !newOwnerId) {
      throw new Error("Project ID and new owner ID are required.");
    }

    const apiUrl = ENDPOINTS.PROJECT_UPDATE_OWNER; // Use the endpoint from config
    console.log(`🚀 Updating project owner for project ${projectId} to user ${newOwnerId}`);
    console.log(`📡 Full API URL: ${apiUrl}`);

    const response = await axios.put(
      apiUrl,
      { ProjectID: projectId, NewOwnerID: newOwnerId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Project owner updated successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error updating project owner:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      throw new Error("The endpoint was not found. Please verify the API URL.");
    }
    throw new Error(error.response?.data || "Failed to update project owner.");
  }
};
// Function to remove a member from a project (Only for project owner)
export const removeMemberFromProject = async (projectId, memberId) => {
  try {
    const response = await axios.delete(
              `${ENDPOINTS.PROJECT_MEMBERS(projectId)}/${memberId}`,
      createAuthenticatedRequest()
    );
    return response.data;
  } catch (error) {
    console.error('❌ Error removing member:', error.response?.data || error.message);
    throw error;
  }
};

// Function to delete a project (Only for project owner)
export const deleteProject = async (projectId) => {
  try {
    await api.delete(ENDPOINTS.PROJECT_BY_ID(projectId));
  } catch (error) {
    return handleApiError(error, 'deleting project');
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

    // Validate sprint data
    if (!sprintData || !sprintData.id || !sprintData.projectID) {
      throw new Error("❌ Sprint data is missing or Sprint ID/Project ID is not provided.");
    }

    // Ensure dates are in ISO format
    const formattedSprintData = {
      id: sprintData.id,
      name: sprintData.name,
      startDate: new Date(sprintData.startDate).toISOString(), // Ensure correct date format
      endDate: new Date(sprintData.endDate).toISOString(),
      isCompleted: sprintData.isCompleted ?? false,
      isStarted: sprintData.isStarted ?? false,
      projectID: sprintData.projectID,
    };

    const apiUrl = `${API_BASE_URL}/Scrum/Sprint/`; 

    console.log("🚀 Sending PUT request to update sprint:", apiUrl);
    console.log("📤 Sprint Payload:", formattedSprintData);

    // Send the request with the correct payload
    const response = await axios.put(apiUrl, formattedSprintData, {
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

    // Format task data for the API - using PascalCase keys as expected by the backend
    const formattedTaskData = {
      ID: taskData.id,                                 // Use uppercase ID
      Description: taskData.description,               // Use PascalCase
      AssigneeID: taskData.assigneeID === '' ? null : taskData.assigneeID, // Convert empty string to null
      SprintID: taskData.sprintID || null,             // Ensure SprintID is present or null
      Status: Number(taskData.status),                 // Ensure status is a number (0, 1, or 2)
      DateCreated: taskData.dateCreated                // Keep the original date format
    };

    // Validate status is only 0, 1, or 2
    if (![0, 1, 2].includes(Number(formattedTaskData.Status))) {
      throw new Error(`Invalid status value: ${formattedTaskData.Status}. Must be 0, 1, or 2.`);
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Task/`; 

    console.log("🚀 Sending PUT request to update task:", apiUrl);
    console.log("📤 Task Payload:", formattedTaskData);

    const response = await axios.put(apiUrl, formattedTaskData, {
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

    const apiUrl = `${API_BASE_URL}/Scrum/Sprint/Tasks/${sprintId}`; 

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

    const apiUrl = `${API_BASE_URL}/Scrum/Project/Tasks/${projectId}`; 

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
/**
 * Fetches all tasks for a given project and appends assignee initials to each task.
 * This is especially useful for displaying avatar labels or tags in UI components.
 *
 * @param {string} projectId - The unique identifier for the project whose tasks should be fetched.
 * @returns {Promise<Array>} A list of task objects, each with an `assigneeInitials` field added.
 *
 * Notes:
 * - If a task is unassigned (`assigneeID` is null or undefined), the field will be set to "Unassigned".
 * - If user lookup fails, a default of "??" is used for initials.
 * - Uses `Promise.all()` to parallelize user fetch calls, improving overall performance.
 * - Assumes `fetchUserById` returns an object with `firstName` and `lastName` properties.
 */
export const fetchProjectTasksWithAssignees = async (projectId) => {
  try {
    const tasks = await fetchProjectTasks(projectId);
    
    // Fetch each user's initials from `fetchUserById`
    const tasksWithAssignees = await Promise.all(tasks.map(async (task) => {
      if (!task.assigneeID) {
        return { ...task, assigneeInitials: "Unassigned" };
      }

      try {
        const user = await fetchUserById(task.assigneeID);
        const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
        return { ...task, assigneeInitials: initials };
      } catch (error) {
        console.error(`Error fetching user for task ${task.id}:`, error);
        return { ...task, assigneeInitials: "??" }; // Default initials in case of error
      }
    }));

    return tasksWithAssignees;
  } catch (error) {
    console.error("❌ Error fetching tasks with assignees:", error);
    throw error;
  }
};


/**
 * Updates the status of a specific task using its ID.
 * This function is typically used in task boards or sprint views where drag-and-drop
 * or status dropdowns trigger a status update.
 *
 * @param {string} taskId - The unique identifier of the task to update.
 * @param {number} newStatus - The new status to assign to the task (0 = Pending, 1 = In Progress, 2 = Completed).
 * @returns {Promise<Object>} - The updated task data from the API.
 *
 * Best Practices:
 * - Validates taskId and status before making the API call.
 * - Only allows status codes explicitly defined (0, 1, 2).
 * - Uses token-based authentication via headers.
 * - Returns parsed response data for flexible frontend usage.
 */
export const updateTaskStatus = async (taskId, newStatus) => {
  try {
    const token = getAuthToken();

    if (!taskId) throw new Error("❌ Task ID is required.");
    
    // Ensure status is only 0, 1, or 2 (not 3)
    if (![0, 1, 2].includes(Number(newStatus))) {
      throw new Error(`❌ Invalid task status: ${newStatus}. Must be 0, 1, or 2.`);
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Task/${taskId}/Status`;

    console.log(`🚀 Updating task ${taskId} status to ${newStatus}`);

    const response = await axios.put(apiUrl, { status: Number(newStatus) }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("✅ Task status updated successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error updating task status:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Updates the assignee for a specific task in the project management system.
 *
 * @param {string} taskId - The ID of the task to update.
 * @param {string} newAssigneeId - The ID of the user to assign the task to.
 * @returns {Promise<Object>} - The updated task data from the server.
 *
 * @throws Will throw an error if the task ID or assignee ID is missing.
 * @throws Will throw an error if the API request fails.
 *
 * @example
 * await updateTaskAssignee("task123", "user456");
 */

export const updateTaskAssignee = async (taskId, newAssigneeId) => {
  try {
    const token = getAuthToken();

    if (!taskId) throw new Error("❌ Task ID is required.");
    if (!newAssigneeId) throw new Error("❌ Assignee ID is required.");

    const apiUrl = `${API_BASE_URL}/Scrum/Task/${taskId}/Assignee`;

    console.log(`🚀 Updating task ${taskId} assignee to user ${newAssigneeId}`);

    const response = await axios.put(apiUrl, { assigneeID: newAssigneeId }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("✅ Task assignee updated successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error updating task assignee:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetches all sprints associated with a given project.
 *
 * @param {string} projectId - The ID of the project whose sprints are to be retrieved.
 * @returns {Promise<Array>} - A promise that resolves to an array of sprint objects.
 *
 * @throws {Error} - Throws an error if the project ID is missing or if the API request fails.
 *
 * @example
 * const sprints = await fetchProjectSprints("project123");
 */

export const fetchProjectSprints = async (projectId) => {
  try {
    const token = getAuthToken();

    if (!projectId) {
      throw new Error("❌ Project ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Project/Sprints/${projectId}`; 

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
/**
 * Fetches detailed information for a specific sprint by its ID.
 *
 * @param {string} sprintId - The unique identifier of the sprint to retrieve.
 * @returns {Promise<Object>} - A promise that resolves to the sprint object.
 *
 * @throws {Error} - Throws an error if the sprint ID is not provided or if the request fails.
 *
 * @example
 * const sprint = await fetchSprintById("sprint456");
 */

export const fetchSprintById = async (sprintId) => {
  try {
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Sprint/${sprintId}`; 

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
/**
 * Fetches detailed information for a specific task by its ID.
 *
 * @param {string} taskId - The unique identifier of the task to retrieve.
 * @returns {Promise<Object>} - A promise that resolves to the task object.
 *
 * @throws {Error} - Throws an error if the task ID is not provided or if the request fails.
 *
 * @example
 * const task = await fetchTaskById("task789");
 */

export const fetchTaskById = async (taskId) => {
  try {
    const token = getAuthToken();

    if (!taskId) {
      throw new Error("❌ Task ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Task/${taskId}`; 

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
/**
 * Deletes a task by its ID.
 *
 * @param {string} taskId - The ID of the task to delete.
 * @returns {Promise<Object>} - The server response confirming deletion.
 *
 * @throws {Error} - If the task ID is not provided or the API call fails.
 *
 * @example
 * await deleteTask("task123");
 */

export const deleteTask = async (taskId) => {
  try {
    const token = getAuthToken();

    if (!taskId) {
      throw new Error("❌ Task ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Task/${taskId}`; 

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
/**
 * Deletes a sprint by its ID.
 *
 * @param {string} sprintId - The ID of the sprint to delete.
 * @returns {Promise<Object>} - The server response confirming deletion.
 *
 * @throws {Error} - If the sprint ID is not provided or the API call fails.
 *
 * @example
 * await deleteSprint("sprint456");
 */

export const deleteSprint = async (sprintId) => {
  try {
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    const apiUrl = `${API_BASE_URL}/Scrum/Sprint/${sprintId}`; 

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

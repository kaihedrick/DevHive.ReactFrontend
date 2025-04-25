import axios from "axios";
import { API_BASE_URL } from '../config';
import { useState, useCallback, useEffect } from 'react';
import { getAuthToken } from './projectService'; 

/**
 * Fetch all sprints for a specific project.
 * @param {string} projectId - The ID of the project to retrieve sprints for.
 * @returns {Promise<Array>} - An array of sprint objects.
 */
export const fetchProjectSprints = async (projectId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!projectId) {
      throw new Error("❌ Project ID is required.");
    }

    console.log("🚀 Fetching sprints for project:", projectId);
    
    const response = await axios.get(`${API_BASE_URL}/Scrum/Project/Sprints/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("✅ Retrieved project sprints:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching project sprints:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch a single sprint by its ID.
 * @param {string} sprintId - The unique ID of the sprint.
 * @returns {Promise<Object>} - The sprint object retrieved from the API.
 */
export const fetchSprintById = async (sprintId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    console.log("🚀 Fetching sprint details for:", sprintId);
    
    const response = await axios.get(`${API_BASE_URL}/Scrum/Sprint/${sprintId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("✅ Retrieved sprint details:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching sprint:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Create a new sprint associated with a given project.
 * @param {Object} sprintData - Data for the new sprint, including projectID.
 * @returns {Promise<Object>} - The newly created sprint.
 */
export const createSprint = async (sprintData) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintData || !sprintData.projectID) {
      throw new Error("❌ Sprint data is missing or project ID is not provided.");
    }

    console.log("🚀 Creating new sprint for project:", sprintData.projectID);
    console.log("📦 Sprint data:", sprintData);
    
    const response = await axios.post(`${API_BASE_URL}/Scrum/Sprint/`, sprintData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("✅ Sprint created successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error creating sprint:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Edit an existing sprint's data.
 * @param {Object} sprintData - Sprint data including an existing sprint ID.
 * @returns {Promise<Object>} - The updated sprint object.
 */
export const editSprint = async (sprintData) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintData || !sprintData.id) {
      throw new Error("❌ Sprint data is missing or Sprint ID is not provided.");
    }
    
    // Format dates properly if they are provided as Date objects
    const formattedData = {
      ...sprintData,
      startDate: typeof sprintData.startDate === 'object' 
        ? sprintData.startDate.toISOString() 
        : sprintData.startDate,
      endDate: typeof sprintData.endDate === 'object' 
        ? sprintData.endDate.toISOString() 
        : sprintData.endDate
    };

    console.log("🚀 Updating sprint:", formattedData.id);
    console.log("📦 Updated sprint data:", formattedData);
    
    const response = await axios.put(`${API_BASE_URL}/Scrum/Sprint/`, formattedData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("✅ Sprint updated successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error updating sprint:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete a sprint by its ID.
 * @param {string} sprintId - The ID of the sprint to delete.
 * @returns {Promise<Object>} - Response from the delete operation.
 */
export const deleteSprint = async (sprintId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    console.log("🚀 Deleting sprint:", sprintId);
    
    const response = await axios.delete(`${API_BASE_URL}/Scrum/Sprint/${sprintId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log(`✅ Sprint ${sprintId} deleted successfully`);
    return response.data;
  } catch (error) {
    console.error("❌ Error deleting sprint:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Start a sprint by marking its `isStarted` field to true.
 * @param {string} sprintId - The ID of the sprint to start.
 * @returns {Promise<Object>} - The updated sprint object.
 */
export const startSprint = async (sprintId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    console.log("🚀 Starting sprint:", sprintId);
    
    // Since there's no dedicated endpoint for this in your backend,
    // we'll update the sprint with isStarted=true
    const sprint = await fetchSprintById(sprintId);
    
    if (!sprint) {
      throw new Error("❌ Sprint not found.");
    }
    
    const updateData = {
      ...sprint,
      isStarted: true
    };
    
    const response = await editSprint(updateData);

    console.log(`✅ Sprint ${sprintId} started successfully`);
    return response;
  } catch (error) {
    console.error("❌ Error starting sprint:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Complete a sprint by marking its `isCompleted` field to true.
 * @param {string} sprintId - The ID of the sprint to complete.
 * @returns {Promise<Object>} - The updated sprint object.
 */
export const completeSprint = async (sprintId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    console.log("🚀 Completing sprint:", sprintId);
    
    // Since there's no dedicated endpoint for this in your backend,
    // we'll update the sprint with isCompleted=true
    const sprint = await fetchSprintById(sprintId);
    
    if (!sprint) {
      throw new Error("❌ Sprint not found.");
    }
    
    const updateData = {
      ...sprint,
      isCompleted: true
    };
    
    const response = await editSprint(updateData);

    console.log(`✅ Sprint ${sprintId} completed successfully`);
    return response;
  } catch (error) {
    console.error("❌ Error completing sprint:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch only the active (in-progress) sprints for a given project.
 * @param {string} projectId - The ID of the project.
 * @returns {Promise<Array>} - Array of active sprints.
 */

export const fetchActiveProjectSprints = async (projectId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!projectId) {
      throw new Error("❌ Project ID is required.");
    }

    console.log("🚀 Fetching active sprints for project:", projectId);
    
    const response = await axios.get(`${API_BASE_URL}/Scrum/Project/Sprints/Active/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("✅ Retrieved active project sprints:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching active project sprints:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Retrieve all tasks associated with a sprint.
 * @param {string} sprintId - The ID of the sprint.
 * @returns {Promise<Array>} - Array of task objects.
 */
export const fetchSprintTasks = async (sprintId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    console.log("🚀 Fetching tasks for sprint:", sprintId);
    
    const response = await axios.get(`${API_BASE_URL}/Scrum/Sprint/Tasks/${sprintId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("✅ Retrieved sprint tasks:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching sprint tasks:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * Check for overlapping sprint dates against existing sprints.
 * @param {Date|string} newStart - Proposed start date.
 * @param {Date|string} newEnd - Proposed end date.
 * @param {Array} existingSprints - Array of existing sprints.
 * @param {string|null} [currentSprintId] - Sprint ID to exclude from check.
 * @returns {boolean} - True if overlap is found, false otherwise.
 */
export const checkSprintDateOverlap = (newStart, newEnd, existingSprints, currentSprintId = null) => {
  const start = new Date(newStart);
  const end = new Date(newEnd);
  
  return existingSprints.some(sprint => {
    // Skip current sprint when editing
    if (currentSprintId && sprint.id === currentSprintId) {
      return false;
    }
    
    const sprintStart = new Date(sprint.startDate);
    const sprintEnd = new Date(sprint.endDate);
    
    // Check if date ranges overlap
    return (
      (start >= sprintStart && start <= sprintEnd) || // New start date falls within existing sprint
      (end >= sprintStart && end <= sprintEnd) || // New end date falls within existing sprint
      (start <= sprintStart && end >= sprintEnd) // New sprint completely encompasses existing sprint
    );
  });
};

/**
 * Calculate all disabled dates between sprints.
 * @param {Array} existingSprints - Array of sprint objects.
 * @param {string|null} [currentSprintId] - Sprint ID to exclude from check.
 * @returns {string[]} - Array of ISO date strings that are disabled.
 */
export const getDisabledDates = (existingSprints, currentSprintId = null) => {
  const disabledDates = [];
  
  existingSprints.forEach(sprint => {
    // Skip current sprint when editing
    if (currentSprintId && sprint.id === currentSprintId) {
      return;
    }
    
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    
    // Add all dates between start and end (inclusive) to disabledDates
    let current = new Date(start);
    while (current <= end) {
      disabledDates.push(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
  });
  
  return disabledDates;
};

/**
 * React hook to fetch and manage a single sprint.
 * @param {string} sprintId - The sprint ID to track.
 * @returns {Object} - Contains sprint data, loading state, error, and a refresh function.
 */

export const useSprint = (sprintId) => {
  const [sprint, setSprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSprint = useCallback(async () => {
    if (!sprintId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchSprintById(sprintId);
      setSprint(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching sprint:', err);
    } finally {
      setLoading(false);
    }
  }, [sprintId]);

  useEffect(() => {
    fetchSprint();
  }, [fetchSprint]);

  return { sprint, loading, error, refreshSprint: fetchSprint };
};

/**
 * React hook to manage project-level sprint state and actions.
 * @param {string} projectId - The project ID to track.
 * @returns {Object} - Contains sprints, loading, error, and CRUD functions.
 */
export const useProjectSprints = (projectId) => {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSprints = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await fetchProjectSprints(projectId);
      setSprints(data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching project sprints:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Function to refresh after creating a sprint
  const createNewSprint = useCallback(async (sprintData) => {
    try {
      await createSprint({ ...sprintData, projectID: projectId });
      await fetchSprints(); // Refresh sprints after creation
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('❌ Error creating sprint:', err);
      return { success: false, error: err.message };
    }
  }, [projectId, fetchSprints]);

  // Function to refresh after updating a sprint
  const updateSprint = useCallback(async (sprintData) => {
    try {
      await editSprint(sprintData);
      await fetchSprints(); // Refresh sprints after update
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('❌ Error updating sprint:', err);
      return { success: false, error: err.message };
    }
  }, [fetchSprints]);

  // Function to delete a sprint
  const removeSprint = useCallback(async (sprintId) => {
    try {
      await deleteSprint(sprintId);
      await fetchSprints(); // Refresh sprints after deletion
      return { success: true };
    } catch (err) {
      setError(err.message);
      console.error('❌ Error deleting sprint:', err);
      return { success: false, error: err.message };
    }
  }, [fetchSprints]);

  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);

  return { 
    sprints, 
    loading, 
    error, 
    refreshSprints: fetchSprints, 
    createSprint: createNewSprint,
    updateSprint,
    deleteSprint: removeSprint
  };
};

/**
 * Validate sprint start and end dates and check for overlap.
 * @param {string|Date} startDate - Sprint start date.
 * @param {string|Date} endDate - Sprint end date.
 * @param {Array} existingSprints - Existing sprints to compare against.
 * @param {string|null} [currentSprintId] - ID to exclude when editing.
 * @returns {Object} - Validity status and optional error message.
 */
export const validateSprintDates = (startDate, endDate, existingSprints, currentSprintId = null) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if end date is after start date
  if (end <= start) {
    return { valid: false, error: "End date must be after start date" };
  }
  
  // Check for overlaps with existing sprints
  if (checkSprintDateOverlap(startDate, endDate, existingSprints, currentSprintId)) {
    return { valid: false, error: "Sprint dates overlap with existing sprints" };
  }
  
  return { valid: true };
};
import axios from "axios";
import { API_BASE_URL } from '../config';
import { useState, useCallback, useEffect } from 'react';
import { getAuthToken } from './projectService'; 

// Function to fetch all sprints for a given project
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

// Function to fetch a single sprint by its ID
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

// Function to create a new sprint for a project
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

// Function to edit/update an existing sprint
export const editSprint = async (sprintData) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintData || !sprintData.id) {
      throw new Error("❌ Sprint data is missing or Sprint ID is not provided.");
    }

    console.log("🚀 Updating sprint:", sprintData.id);
    console.log("📦 Updated sprint data:", sprintData);
    
    const response = await axios.put(`${API_BASE_URL}/Scrum/Sprint/`, sprintData, {
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

// Function to delete a sprint by its ID
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

// Function to start a sprint
export const startSprint = async (sprintId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    console.log("🚀 Starting sprint:", sprintId);
    
    const response = await axios.put(`${API_BASE_URL}/Scrum/Sprint/Start/${sprintId}`, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Sprint ${sprintId} started successfully`);
    return response.data;
  } catch (error) {
    console.error("❌ Error starting sprint:", error.response?.data || error.message);
    throw error;
  }
};

// Function to complete a sprint
export const completeSprint = async (sprintId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!sprintId) {
      throw new Error("❌ Sprint ID is required.");
    }

    console.log("🚀 Completing sprint:", sprintId);
    
    const response = await axios.put(`${API_BASE_URL}/Scrum/Sprint/Complete/${sprintId}`, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Sprint ${sprintId} completed successfully`);
    return response.data;
  } catch (error) {
    console.error("❌ Error completing sprint:", error.response?.data || error.message);
    throw error;
  }
};

// Check if dates overlap with existing sprints
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

// Get disabled dates based on existing sprints
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

// Add a similar hook as in projectService for consistency
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
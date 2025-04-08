import axios from "axios";
import { API_BASE_URL } from '../config';
import { getAuthToken } from './projectService'; // Reuse auth helper from projectService
import { fetchUserById } from './userService';
import { useState, useCallback, useEffect } from 'react';

// Function to fetch all tasks for a given project
export const fetchProjectTasks = async (projectId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!projectId) {
      throw new Error("❌ Project ID is required.");
    }

    console.log("🚀 Fetching tasks for project:", projectId);
    
    const response = await axios.get(`${API_BASE_URL}/Scrum/Project/Tasks/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("✅ Retrieved project tasks:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching project tasks:", error.response?.data || error.message);
    throw error;
  }
};

// Function to fetch all tasks for a given sprint
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

// Enhanced function to fetch tasks with assignee details
export const fetchProjectTasksWithAssignees = async (projectId) => {
  try {
    // Get tasks for the project
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

// Function to fetch a single task by its ID
export const fetchTaskById = async (taskId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!taskId) {
      throw new Error("❌ Task ID is required.");
    }

    console.log("🚀 Fetching task details for:", taskId);
    
    const response = await axios.get(`${API_BASE_URL}/Scrum/Task/${taskId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("✅ Retrieved task details:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching task:", error.response?.data || error.message);
    throw error;
  }
};

// Function to create a new task
export const createTask = async (taskData) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!taskData || !taskData.sprintID) {
      throw new Error("❌ Task data is missing or Sprint ID is not provided.");
    }

    console.log("🚀 Creating new task for sprint:", taskData.sprintID);
    console.log("📦 Task data:", taskData);
    
    const response = await axios.post(`${API_BASE_URL}/Scrum/Task/`, taskData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("✅ Task created successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error creating task:", error.response?.data || error.message);
    throw error;
  }
};

// Function to edit/update an existing task
export const editTask = async (task) => {
  try {
    const token = getAuthToken();
    
    if (!task || !task.ID) {
      throw new Error("❌ Task data is missing or Task ID is not provided.");
    }
    
    console.log("🚀 Updating task:", task.ID);
    console.log("📦 Updated task data:", task);
    
    const response = await axios.put(`${API_BASE_URL}/Scrum/Task/`, task, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("✅ Task updated successfully");
    return response.data;
  } catch (error) {
    console.error("❌ Error updating task:", error.response?.data || error.message);
    throw error;
  }
};

// Function to update task status
export const updateTaskStatus = async (taskId, newStatus) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!taskId) {
      throw new Error("❌ Task ID is required.");
    }

    console.log(`🚀 Updating status for task ${taskId} to ${newStatus}`);
    
    const payload = {
      ID: taskId,
      Status: Number(newStatus)
    };

    const response = await axios.put(`${API_BASE_URL}/Scrum/Task/Status/`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Task ${taskId} status updated successfully`);
    return response.data;
  } catch (error) {
    console.error("❌ Error updating task status:", error.response?.data || error.message);
    throw error;
  }
};

// Function to update task assignee
export const updateTaskAssignee = async (taskId, newAssigneeId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!taskId) {
      throw new Error("❌ Task ID is required.");
    }
    if (!newAssigneeId) {
      throw new Error("❌ Assignee ID is required.");
    }

    console.log(`🚀 Updating assignee for task ${taskId} to user ${newAssigneeId}`);
    
    const payload = {
      assigneeID: newAssigneeId
    };

    const response = await axios.put(`${API_BASE_URL}/Scrum/Task/${taskId}/Assignee`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Task ${taskId} assignee updated successfully`);
    return response.data;
  } catch (error) {
    console.error("❌ Error updating task assignee:", error.response?.data || error.message);
    throw error;
  }
};

// Function to delete a task by its ID
export const deleteTask = async (taskId) => {
  try {
    // Get auth token
    const token = getAuthToken();

    if (!taskId) {
      throw new Error("❌ Task ID is required.");
    }

    console.log("🚀 Deleting task:", taskId);
    
    const response = await axios.delete(`${API_BASE_URL}/Scrum/Task/${taskId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log(`✅ Task ${taskId} deleted successfully`);
    return response.data;
  } catch (error) {
    console.error("❌ Error deleting task:", error.response?.data || error.message);
    throw error;
  }
};

// Add a similar hook as in projectService for consistency
export const useTask = (taskId) => {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTask = useCallback(async () => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchTaskById(taskId);
      setTask(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('❌ Error fetching task:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  return { task, loading, error, refreshTask: fetchTask };
};

// Helper function to get tasks by status
export const getTasksByStatus = (tasks, status) => {
  return tasks.filter(task => task.status === status);
};
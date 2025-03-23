import { useState, useCallback, useEffect } from 'react';
import { 
  fetchProjectTasksWithAssignees,
  fetchSprintTasks,
  fetchTaskById,
  createTask,
  editTask,
  updateTaskStatus,
  updateTaskAssignee
} from '../services/taskService';

export const useTaskManagement = (projectId, sprintId = null) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  // Tasks categorized by status
  const todoTasks = tasks.filter(task => task.status === 0);
  const inProgressTasks = tasks.filter(task => task.status === 1);
  const completedTasks = tasks.filter(task => task.status === 3);

  const clearError = () => {
    setError(null);
  };

  const fetchTasks = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      let data;
      
      if (sprintId) {
        // Fetch tasks for specific sprint
        data = await fetchSprintTasks(sprintId);
      } else {
        // Fetch all project tasks
        data = await fetchProjectTasksWithAssignees(projectId);
      }
      
      setTasks(data || []);
      setError(null);
    } catch (err) {
      // Check if this is an auth error (401)
      if (err.response && err.response.status === 401) {
        console.error("Authentication error when fetching tasks:", err);
        setError("Your session has expired. Please log in again.");
        // Optionally redirect to login page or show a login modal
      } else {
        setError(err.message || "Failed to load tasks");
        console.error("Error fetching tasks:", err);
      }
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, sprintId]);

  const refreshTask = async (taskId) => {
    try {
      console.log(`🔄 Refreshing task: ${taskId}`);
      const updatedTask = await fetchTaskById(taskId);
      
      setTasks(prevTasks =>
        prevTasks.map(task => (task.id === taskId ? updatedTask : task))
      );
      
      console.log(`✅ Task refreshed: ${taskId}`);
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || `Failed to refresh task ${taskId}`;
      console.error(`❌ ${errorMessage}`, err);
      return { success: false, error: errorMessage };
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!taskData.description) {
        throw new Error("Task description is required");
      }
      
      if (!taskData.sprintID) {
        throw new Error("Sprint selection is required");
      }
      
      console.log("🔄 Creating new task:", taskData);
      
      // Add additional fields
      const fullTaskData = {
        ...taskData,
        dateCreated: new Date().toISOString(),
        status: 0, // Default status: To Do
        projectID: projectId // Ensure project ID is included
      };
      
      await createTask(fullTaskData);
      console.log("✅ Task created successfully");
      
      await fetchTasks(); // Refresh tasks after creation
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || "Failed to create task";
      console.error(`❌ Error creating task: ${errorMessage}`, err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (taskData) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!taskData.id) {
        throw new Error("Task ID is required for updating");
      }
      
      console.log(`🔄 Updating task: ${taskData.id}`, taskData);
      
      await editTask(taskData);
      console.log(`✅ Task ${taskData.id} updated successfully`);
      
      await fetchTasks(); // Refresh tasks after update
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || "Failed to update task";
      console.error(`❌ Error updating task: ${errorMessage}`, err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      console.log(`🔄 Updating task ${taskId} status to ${newStatus}`);
      
      if (![0, 1, 3].includes(Number(newStatus))) {
        throw new Error(`Invalid status value: ${newStatus}`);
      }
      
      await updateTaskStatus(taskId, newStatus);
      console.log(`✅ Task ${taskId} status updated to ${newStatus}`);
      
      await refreshTask(taskId);
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || "Failed to update task status";
      console.error(`❌ Error updating task status: ${errorMessage}`, err);
      return { success: false, error: errorMessage };
    }
  };

  const handleUpdateTaskAssignee = async (taskId, newAssigneeId) => {
    try {
      console.log(`🔄 Updating task ${taskId} assignee to ${newAssigneeId}`);
      
      if (!newAssigneeId) {
        throw new Error("Assignee ID is required");
      }
      
      await updateTaskAssignee(taskId, newAssigneeId);
      console.log(`✅ Task ${taskId} assignee updated to ${newAssigneeId}`);
      
      await refreshTask(taskId);
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || "Failed to update task assignee";
      console.error(`❌ Error updating task assignee: ${errorMessage}`, err);
      return { success: false, error: errorMessage };
    }
  };

  // Validate task data before creation or update
  const validateTaskData = (taskData) => {
    if (!taskData.description || taskData.description.trim() === '') {
      return { valid: false, error: "Task description is required" };
    }
    
    if (!taskData.sprintID) {
      return { valid: false, error: "Sprint selection is required" };
    }
    
    return { valid: true };
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    todoTasks,
    inProgressTasks,
    completedTasks,
    selectedTask,
    setSelectedTask,
    loading,
    error,
    clearError,
    fetchTasks,
    refreshTask,
    handleCreateTask,
    handleUpdateTask,
    handleUpdateTaskStatus,
    handleUpdateTaskAssignee,
    validateTaskData
  };
};
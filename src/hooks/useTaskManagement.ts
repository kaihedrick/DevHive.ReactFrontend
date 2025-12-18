import { useState, useCallback, useEffect } from 'react';
import { 
  fetchProjectTasks,
  fetchSprintTasks,
  fetchTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  assignTask
} from '../services/taskService';
import { 
  UseTaskManagementReturn, 
  Task, 
  CreateTaskData, 
  UpdateTaskData 
} from '../types/hooks.ts';

/**
 * useTaskManagement
 *
 * Custom React hook for managing tasks at the project or sprint level.
 *
 * @param {string} projectId - The ID of the current project
 * @param {string|null} sprintId - Optional sprint ID for fetching sprint-specific tasks
 * @returns {UseTaskManagementReturn} Task state and operations
 */
export const useTaskManagement = (projectId: string, sprintId: string | null = null): UseTaskManagementReturn => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Tasks categorized by status
  const todoTasks = tasks.filter(task => task.status === 0);
  const inProgressTasks = tasks.filter(task => task.status === 1);
  const completedTasks = tasks.filter(task => task.status === 2);

  const clearError = (): void => {
    setError(null);
  };

  const fetchTasks = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      let data: Task[];
      
      if (sprintId) {
        // Fetch tasks for specific sprint
        const response = await fetchSprintTasks(sprintId, { limit: 100, offset: 0 });
        data = response.tasks || [];
      } else {
        // Fetch all project tasks
        const response = await fetchProjectTasks(projectId, { limit: 100, offset: 0 });
        data = response.tasks || [];
      }
      
      setTasks(data || []);
      setError(null);
    } catch (err: any) {
      // Check if this is an auth error (401)
      if (err.response && err.response.status === 401) {
        console.error("Authentication error when fetching tasks:", err);
        setError("Your session has expired. Please log in again.");
      } else {
        setError(err.message || "Failed to load tasks");
        console.error("Error fetching tasks:", err);
      }
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, sprintId]);

  const refreshTask = async (taskId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`🔄 Refreshing task: ${taskId}`);
      const updatedTask = await fetchTaskById(taskId);
      
      setTasks(prevTasks =>
        prevTasks.map(task => (task.id === taskId ? updatedTask : task))
      );
      
      console.log(`✅ Task refreshed: ${taskId}`);
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || `Failed to refresh task ${taskId}`;
      console.error(`❌ ${errorMessage}`, err);
      return { success: false, error: errorMessage };
    }
  };

  const handleCreateTask = async (taskData: CreateTaskData): Promise<{ success: boolean; error?: string }> => {
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
      
      // Transform data for Go/PostgreSQL API
      const payload = {
        description: taskData.description,
        status: 0, // Default status: 0 (pending) for Go backend
        ...(taskData.sprintID && { sprintId: taskData.sprintID }),
        ...(taskData.assigneeId && { assigneeId: taskData.assigneeId })
      };
      
      await createTask(projectId, payload);
      console.log("✅ Task created successfully");
      
      await fetchTasks(); // Refresh tasks after creation
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create task";
      console.error(`❌ Error creating task: ${errorMessage}`, err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (taskData: UpdateTaskData): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      setError(null);
      
      if (!taskData.id) {
        throw new Error("Task ID is required for updating");
      }
      
      console.log(`🔄 Updating task: ${taskData.id}`, taskData);
      
      // Transform data for Go/PostgreSQL API
      const payload = {
        description: taskData.description,
        ...(taskData.status !== undefined && { status: taskData.status }),
        ...(taskData.sprintID && { sprintId: taskData.sprintID }),
        ...(taskData.assigneeId && { assigneeId: taskData.assigneeId })
      };
      
      await updateTask(taskData.id, payload);
      console.log(`✅ Task ${taskData.id} updated successfully`);
      
      await fetchTasks(); // Refresh tasks after update
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to update task";
      console.error(`❌ Error updating task: ${errorMessage}`, err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: number): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`🔄 Updating task ${taskId} status to ${newStatus}`);
      
      // Validate status values for Go/PostgreSQL backend
      const validStatuses = [0, 1, 2]; // 0: pending, 1: in_progress, 2: completed
      const numericStatus = Number(newStatus);
      
      if (!validStatuses.includes(numericStatus)) {
        throw new Error(`Invalid status value: ${newStatus}. Must be 0, 1, or 2`);
      }
      
      await updateTaskStatus(taskId, numericStatus);
      console.log(`✅ Task ${taskId} status updated to ${numericStatus}`);
      
      await refreshTask(taskId);
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to update task status";
      console.error(`❌ Error updating task status: ${errorMessage}`, err);
      return { success: false, error: errorMessage };
    }
  };

  const handleUpdateTaskAssignee = async (taskId: string, newAssigneeId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`🔄 Updating task ${taskId} assignee to ${newAssigneeId}`);
      
      if (!newAssigneeId) {
        throw new Error("Assignee ID is required");
      }
      
      await assignTask(taskId, newAssigneeId);
      console.log(`✅ Task ${taskId} assignee updated to ${newAssigneeId}`);
      
      await refreshTask(taskId);
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to update task assignee";
      console.error(`❌ Error updating task assignee: ${errorMessage}`, err);
      return { success: false, error: errorMessage };
    }
  };

  // Validate task data before creation or update
  const validateTaskData = (taskData: CreateTaskData | UpdateTaskData): { valid: boolean; error?: string } => {
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

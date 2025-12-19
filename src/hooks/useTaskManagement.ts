import { useState, useMemo } from 'react';
import { 
  useProjectTasks,
  useSprintTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useUpdateTaskStatus
} from './useTasks.ts';
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
 * Now uses TanStack Query for caching and data management.
 *
 * @param {string} projectId - The ID of the current project
 * @param {string|null} sprintId - Optional sprint ID for fetching sprint-specific tasks
 * @returns {UseTaskManagementReturn} Task state and operations
 */
export const useTaskManagement = (projectId: string, sprintId: string | null = null): UseTaskManagementReturn => {
  // UI state only - TanStack Query manages data state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // TanStack Query hooks for data fetching
  const projectTasksQuery = useProjectTasks(sprintId ? null : projectId, { limit: 100, offset: 0 });
  const sprintTasksQuery = useSprintTasks(sprintId, { limit: 100, offset: 0 });
  
  // Use appropriate query based on sprintId
  const tasksQuery = sprintId ? sprintTasksQuery : projectTasksQuery;
  
  // Mutation hooks
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const updateTaskStatusMutation = useUpdateTaskStatus();

  // Extract tasks array from response
  const tasks: Task[] = useMemo(() => {
    if (!tasksQuery.data) return [];
    return tasksQuery.data.tasks || tasksQuery.data || [];
  }, [tasksQuery.data]);

  // Tasks categorized by status
  const todoTasks = useMemo(() => tasks.filter(task => task.status === 0), [tasks]);
  const inProgressTasks = useMemo(() => tasks.filter(task => task.status === 1), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(task => task.status === 2), [tasks]);

  // Loading and error states
  const loading = tasksQuery.isLoading;
  const error: string | null = tasksQuery.error ? String(tasksQuery.error) : null;

  const clearError = (): void => {
    // Errors are managed by TanStack Query
    // This function exists for interface compatibility only
  };

  // Refetch function for backward compatibility (TanStack Query handles this automatically)
  const fetchTasks = async (): Promise<void> => {
    // TanStack Query automatically refetches when query key changes
    // This function exists for interface compatibility only
  };

  const refreshTask = async (taskId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`🔄 Refreshing task: ${taskId}`);
      // Use useTask hook to get fresh task data
      // Note: This will trigger a refetch if the query is already active
      // For now, we'll rely on cache invalidation from mutations
      // Cache will be invalidated automatically by WebSocket or mutations
      console.log(`✅ Task refresh requested: ${taskId} (cache will update automatically)`);
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || `Failed to refresh task ${taskId}`;
      console.error(`❌ ${errorMessage}`, err);
      return { success: false, error: errorMessage };
    }
  };

  const handleCreateTask = async (taskData: CreateTaskData): Promise<{ success: boolean; error?: string }> => {
    try {
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
      
      await createTaskMutation.mutateAsync({ projectId, taskData: payload });
      console.log("✅ Task created successfully");
      // Cache invalidation handled automatically by mutation
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create task";
      console.error(`❌ Error creating task: ${errorMessage}`, err);
      return { success: false, error: errorMessage };
    }
  };

  const handleUpdateTask = async (taskData: UpdateTaskData): Promise<{ success: boolean; error?: string }> => {
    try {
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
      
      await updateTaskMutation.mutateAsync({ taskId: taskData.id, taskData: payload });
      console.log(`✅ Task ${taskData.id} updated successfully`);
      // Cache invalidation handled automatically by mutation
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || "Failed to update task";
      console.error(`❌ Error updating task: ${errorMessage}`, err);
      return { success: false, error: errorMessage };
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
      
      await updateTaskStatusMutation.mutateAsync({ taskId, status: numericStatus });
      console.log(`✅ Task ${taskId} status updated to ${numericStatus}`);
      // Cache invalidation handled automatically by mutation
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
      
      // Use updateTask mutation instead of assignTask (assignTask is just updateTask with assigneeId)
      await updateTaskMutation.mutateAsync({ 
        taskId, 
        taskData: { assigneeId: newAssigneeId } 
      });
      console.log(`✅ Task ${taskId} assignee updated to ${newAssigneeId}`);
      // Cache invalidation handled automatically by mutation
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

import { useState, useEffect, useMemo } from 'react';
import { useSprints } from './useSprints.ts';
import { useSprintTasks, useUpdateTask, useUpdateTaskStatus } from './useTasks.ts';
import { useProjectMembers } from './useProjects.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { UseBoardActionsReturn, Sprint, Task, User } from '../types/hooks.ts';

/**
 * useBoardActions
 *
 * Custom hook to manage board-related logic for the project Kanban board.
 *
 * @param {string} projectId - The ID of the project to load sprints and tasks for.
 * @returns {UseBoardActionsReturn} Hook state and actions
 */
const useBoardActions = (projectId: string): UseBoardActionsReturn => {
  const { showSuccess, showError } = useToast();
  
  // UI state only - TanStack Query manages data state
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // TanStack Query hooks for data fetching
  const { data: sprintsData, isLoading: sprintsLoading, error: sprintsError } = useSprints(projectId);
  const { data: membersData, isLoading: membersLoading, error: membersError } = useProjectMembers(projectId);
  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useSprintTasks(selectedSprint);
  // Note: useSprintTasks already handles enabled internally (enabled: !!sprintId)

  // Mutation hooks
  const updateTaskMutation = useUpdateTask();
  const updateTaskStatusMutation = useUpdateTaskStatus();

  // Extract data arrays from TanStack Query responses
  const sprints: Sprint[] = useMemo(() => {
    if (!sprintsData) return [];
    return sprintsData.sprints || sprintsData || [];
  }, [sprintsData]);

  const members: User[] = useMemo(() => {
    if (!membersData) return [];
    return membersData.members || membersData || [];
  }, [membersData]);

  const tasks: Task[] = useMemo(() => {
    if (!tasksData) return [];
    return tasksData.tasks || tasksData || [];
  }, [tasksData]);

  // Combine loading and error states
  const loading = sprintsLoading || membersLoading || tasksLoading;
  const error: string | null = sprintsError ? String(sprintsError) : membersError ? String(membersError) : tasksError ? String(tasksError) : null;
  
  // Show errors from TanStack Query hooks
  useEffect(() => {
    if (sprintsError) {
      showError(`Failed to load sprints: ${sprintsError}`);
    }
    if (membersError) {
      showError(`Failed to load members: ${membersError}`);
    }
    if (tasksError) {
      showError(`Failed to load tasks: ${tasksError}`);
    }
  }, [sprintsError, membersError, tasksError, showError]);
  
  // setError function for backward compatibility (though errors come from TanStack Query now)
  const setError = (errorMsg: string | null): void => {
    // Errors are now managed by TanStack Query hooks
    // This function exists for interface compatibility only
    if (errorMsg) {
      showError(errorMsg);
    }
  };

  // Set initial selectedSprint when sprints first load
  useEffect(() => {
    if (sprints && sprints.length > 0 && !selectedSprint) {
      setSelectedSprint(sprints[0].id);
    }
  }, [sprints, selectedSprint]);

  // Handle sprint selection change
  const handleSprintChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const sprintId = e.target.value;
    setSelectedSprint(sprintId);
    // Tasks will automatically refetch when selectedSprint changes (query key changes)
  };

  // Handle assignee change
  const handleAssigneeChange = async (task: Task, newAssigneeId: string): Promise<void> => {
    try {
      console.log("Task being updated:", task);
      console.log("New assignee ID:", newAssigneeId);
      
      // Convert empty string to null for unassigned
      const assigneeValue = newAssigneeId === "" ? null : newAssigneeId;
      
      // Use mutation hook - WebSocket will invalidate cache automatically
      await updateTaskMutation.mutateAsync({
        taskId: task.id,
        taskData: { assigneeId: assigneeValue }
      });
      
      // Show success message
      const successMsg = assigneeValue ? "Task assigned" : "Task unassigned";
      setSuccessMessage(successMsg);
      showSuccess(successMsg);
    } catch (err: any) {
      console.error("❌ Error updating task assignee:", err);
      const errorMsg = `Failed to update task assignee: ${err.message}`;
      showError(errorMsg);
    }
  };

  // Handle task status update (when dropped in a column)
  const handleStatusUpdate = async (taskId: string, newStatus: number): Promise<boolean> => {
    try {
      // Validate status values for Go/PostgreSQL backend
      const validStatuses = [0, 1, 2]; // 0: pending, 1: in_progress, 2: completed
      const numericStatus = Number(newStatus);
      
      if (!validStatuses.includes(numericStatus)) {
        throw new Error(`Invalid status value: ${newStatus}. Must be 0, 1, or 2`);
      }
      
      // Use mutation hook - WebSocket will invalidate cache automatically
      await updateTaskStatusMutation.mutateAsync({
        taskId,
        status: numericStatus
      });
      
      // Show success message
      const statusText = numericStatus === 0 ? 'To Do' : numericStatus === 1 ? 'In Progress' : 'Completed';
      const successMsg = `Task moved to ${statusText}`;
      setSuccessMessage(successMsg);
      showSuccess(successMsg);
      
      return true;
    } catch (err: any) {
      const errorMsg = `Failed to update task status: ${err.message}`;
      showError(errorMsg);
      return false;
    }
  };

  // Filter tasks by status
  const getTasksByStatus = (status: number): Task[] => {
    if (!Array.isArray(tasks)) {
      console.warn("⚠️ Tasks is not an array:", tasks);
      return [];
    }
    
    return tasks.filter((task) => task.status === status);
  };

  // Format date from ISO string
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Find member name by ID
  const getAssigneeName = (assigneeId: string | null): string => {
    if (!assigneeId) return 'Unassigned';
    const member = members.find(m => m.id === assigneeId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  return {
    sprints,
    selectedSprint,
    tasks,
    members,
    loading,
    error,
    successMessage,
    draggedTask,
    setDraggedTask,
    setError,
    getTasksByStatus,
    formatDate,
    getAssigneeName,
    handleSprintChange,
    handleAssigneeChange,
    handleStatusUpdate,
    setSuccessMessage,
  };
};

export default useBoardActions;

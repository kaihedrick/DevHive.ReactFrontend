import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectTasks,
  fetchSprintTasks,
  fetchTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
} from '../services/taskService';

// Query keys
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  project: (projectId: string) => [...taskKeys.lists(), 'project', projectId] as const,
  sprint: (sprintId: string) => [...taskKeys.lists(), 'sprint', sprintId] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

/**
 * Hook to fetch all tasks for a project
 * @param projectId The project ID
 * @param options Pagination options
 * @returns Query result with tasks data
 */
export const useProjectTasks = (projectId: string | null | undefined, options?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: taskKeys.project(projectId || ''),
    queryFn: () => fetchProjectTasks(projectId!, options),
    enabled: !!projectId, // Only run query if projectId is provided
    staleTime: 1 * 60 * 1000, // 1 minute - tasks change more frequently
  });
};

/**
 * Hook to fetch all tasks for a sprint
 * @param sprintId The sprint ID
 * @param options Pagination options
 * @returns Query result with tasks data
 */
export const useSprintTasks = (sprintId: string | null | undefined, options?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: taskKeys.sprint(sprintId || ''),
    queryFn: () => fetchSprintTasks(sprintId!, options),
    enabled: !!sprintId, // Only run query if sprintId is provided
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

/**
 * Hook to fetch a single task by ID
 * @param taskId The task ID
 * @returns Query result with task data
 */
export const useTask = (taskId: string | null | undefined) => {
  return useQuery({
    queryKey: taskKeys.detail(taskId || ''),
    queryFn: () => fetchTaskById(taskId!),
    enabled: !!taskId, // Only run query if taskId is provided
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook to create a new task
 * @returns Mutation hook for creating tasks
 */
export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, taskData }: { projectId: string; taskData: any }) =>
      createTask(projectId, taskData),
    onSuccess: (data, variables) => {
      // Invalidate project tasks list
      queryClient.invalidateQueries({ queryKey: taskKeys.project(variables.projectId) });
      // If task has sprintId, invalidate sprint tasks too
      if (variables.taskData.sprintId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.sprint(variables.taskData.sprintId) });
      }
    },
  });
};

/**
 * Hook to update an existing task
 * @returns Mutation hook for updating tasks
 */
export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, taskData }: { taskId: string; taskData: any }) =>
      updateTask(taskId, taskData),
    onSuccess: (data, variables) => {
      // Update the specific task in cache
      queryClient.setQueryData(taskKeys.detail(variables.taskId), data);
      // Invalidate all task lists (we don't know projectId/sprintId here)
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
};

/**
 * Hook to update task status
 * @returns Mutation hook for updating task status
 */
export const useUpdateTaskStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: number }) =>
      updateTaskStatus(taskId, status),
    onSuccess: (data, variables) => {
      // Update the specific task in cache
      queryClient.setQueryData(taskKeys.detail(variables.taskId), data);
      // Invalidate all task lists
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
};

/**
 * Hook to delete a task
 * @returns Mutation hook for deleting tasks
 */
export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      // Invalidate all task lists
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
};


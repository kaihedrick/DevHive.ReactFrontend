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
    // No staleTime - uses Infinity from queryClient
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
    // No staleTime - uses Infinity from queryClient
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
    // No staleTime - uses Infinity from queryClient
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
      // Response now includes complete Assignee object
      const sprintId = data.sprintId;
      const projectId = data.projectId;
      
      // Add to sprint tasks list if sprintId exists
      if (sprintId) {
        queryClient.setQueriesData(
          { queryKey: taskKeys.sprint(sprintId) },
          (oldData: any) => {
            if (!oldData) return [data];
            const isArray = Array.isArray(oldData);
            const tasks = isArray ? oldData : (oldData.tasks || []);
            return isArray ? [...tasks, data] : { ...oldData, tasks: [...tasks, data] };
          }
        );
      }
      
      // Add to project tasks list
      if (projectId) {
        queryClient.setQueriesData(
          { queryKey: taskKeys.project(projectId) },
          (oldData: any) => {
            if (!oldData) return [data];
            const isArray = Array.isArray(oldData);
            const tasks = isArray ? oldData : (oldData.tasks || []);
            return isArray ? [...tasks, data] : { ...oldData, tasks: [...tasks, data] };
          }
        );
      }
      
      // Invalidate lists for consistency
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
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
      // Update task detail cache with complete response
      queryClient.setQueryData(taskKeys.detail(variables.taskId), data);
      
      // SprintID is now always in response - use directly
      const sprintId = data.sprintId;
      const projectId = data.projectId;
      
      // Update sprint tasks list if sprintId exists
      if (sprintId) {
        queryClient.setQueriesData(
          { queryKey: taskKeys.sprint(sprintId) },
          (oldData: any) => {
            if (!oldData) return oldData;
            const isArray = Array.isArray(oldData);
            const tasks = isArray ? oldData : (oldData.tasks || []);
            const updatedTasks = tasks.map((task: any) => 
              task.id === variables.taskId ? data : task
            );
            return isArray ? updatedTasks : { ...oldData, tasks: updatedTasks };
          }
        );
      }
      
      // Update project tasks list if projectId exists
      if (projectId) {
        queryClient.setQueriesData(
          { queryKey: taskKeys.project(projectId) },
          (oldData: any) => {
            if (!oldData) return oldData;
            const isArray = Array.isArray(oldData);
            const tasks = isArray ? oldData : (oldData.tasks || []);
            const updatedTasks = tasks.map((task: any) => 
              task.id === variables.taskId ? data : task
            );
            return isArray ? updatedTasks : { ...oldData, tasks: updatedTasks };
          }
        );
      }
      
      // Invalidate all task lists for consistency (WebSocket will also handle this)
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
      // Update task detail cache with complete response
      queryClient.setQueryData(taskKeys.detail(variables.taskId), data);
      
      // Use SprintID directly from response
      const sprintId = data.sprintId;
      const projectId = data.projectId;
      
      // Update sprint tasks list if sprintId exists
      if (sprintId) {
        queryClient.setQueriesData(
          { queryKey: taskKeys.sprint(sprintId) },
          (oldData: any) => {
            if (!oldData) return oldData;
            const isArray = Array.isArray(oldData);
            const tasks = isArray ? oldData : (oldData.tasks || []);
            const updatedTasks = tasks.map((task: any) => 
              task.id === variables.taskId ? data : task
            );
            return isArray ? updatedTasks : { ...oldData, tasks: updatedTasks };
          }
        );
      }
      
      // Update project tasks list if projectId exists
      if (projectId) {
        queryClient.setQueriesData(
          { queryKey: taskKeys.project(projectId) },
          (oldData: any) => {
            if (!oldData) return oldData;
            const isArray = Array.isArray(oldData);
            const tasks = isArray ? oldData : (oldData.tasks || []);
            const updatedTasks = tasks.map((task: any) => 
              task.id === variables.taskId ? data : task
            );
            return isArray ? updatedTasks : { ...oldData, tasks: updatedTasks };
          }
        );
      }
      
      // Invalidate all task lists for consistency
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


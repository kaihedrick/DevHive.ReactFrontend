import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectSprints,
  fetchSprintById,
  createSprint,
  updateSprint,
  updateSprintStatus,
  deleteSprint,
  startSprint,
  completeSprint,
} from '../services/sprintService';
import { useAuthContext } from '../contexts/AuthContext.tsx';

// Query keys
export const sprintKeys = {
  all: ['sprints'] as const,
  lists: () => [...sprintKeys.all, 'list'] as const,
  list: (projectId: string, filters?: any) => [...sprintKeys.lists(), projectId, filters] as const,
  details: () => [...sprintKeys.all, 'detail'] as const,
  detail: (id: string) => [...sprintKeys.details(), id] as const,
};

/**
 * Hook to fetch all sprints for a project
 * @param projectId The project ID
 * @param options Pagination options
 * @returns Query result with sprints data
 */
export const useSprints = (projectId: string | null | undefined, options?: { limit?: number; offset?: number }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  
  return useQuery({
    queryKey: sprintKeys.list(projectId || '', options),
    queryFn: () => fetchProjectSprints(projectId!, options),
    enabled: !!projectId && isAuthenticated && !authLoading, // ✅ Only fetch when authenticated AND auth is initialized
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 401 - token refresh should handle it
      if (error?.status === 401 || error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to fetch a single sprint by ID
 * @param sprintId The sprint ID
 * @returns Query result with sprint data
 */
export const useSprint = (sprintId: string | null | undefined) => {
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  
  return useQuery({
    queryKey: sprintKeys.detail(sprintId || ''),
    queryFn: () => fetchSprintById(sprintId!),
    enabled: !!sprintId && isAuthenticated && !authLoading, // ✅ Only fetch when authenticated AND auth is initialized
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 401 - token refresh should handle it
      if (error?.status === 401 || error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

/**
 * Hook to create a new sprint
 * @returns Mutation hook for creating sprints
 */
export const useCreateSprint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, sprintData }: { projectId: string; sprintData: any }) =>
      createSprint(projectId, sprintData),
    onSuccess: (data, variables) => {
      // Response now includes Owner
      // Use sprintKeys.lists() with exact: false to match all list queries for this project
      queryClient.setQueriesData(
        { 
          queryKey: ['sprints', 'list', variables.projectId],
          exact: false // Match any query that starts with this key (including those with options)
        },
        (oldData: any) => {
          if (!oldData) return [data];
          const isArray = Array.isArray(oldData);
          const sprints = isArray ? oldData : (oldData.sprints || []);
          // Add new sprint to the beginning of the list
          const updatedSprints = [data, ...sprints];
          return isArray ? updatedSprints : { ...oldData, sprints: updatedSprints };
        }
      );
      
      // Also set the sprint detail cache
      if (data?.id) {
        queryClient.setQueryData(sprintKeys.detail(data.id), data);
      }
      
      // Also invalidate for consistency (WebSocket will also handle this)
      queryClient.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
};

/**
 * Hook to update an existing sprint
 * @returns Mutation hook for updating sprints
 */
export const useUpdateSprint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sprintId, sprintData }: { sprintId: string; sprintData: any }) =>
      updateSprint(sprintId, sprintData),
    onSuccess: (data, variables) => {
      // Response now includes Owner
      queryClient.setQueryData(sprintKeys.detail(variables.sprintId), data);
      
      // Update sprints list for the project - match all queries with this projectId
      queryClient.setQueriesData(
        { 
          queryKey: ['sprints', 'list', data.projectId],
          exact: false // Match any query that starts with this key (including those with options)
        },
        (oldData: any) => {
          if (!oldData) return oldData;
          const isArray = Array.isArray(oldData);
          const sprints = isArray ? oldData : (oldData.sprints || []);
          const updatedSprints = sprints.map((sprint: any) => 
            sprint.id === variables.sprintId ? data : sprint
          );
          return isArray ? updatedSprints : { ...oldData, sprints: updatedSprints };
        }
      );
    },
  });
};

/**
 * Hook to update sprint status (isStarted and/or isCompleted)
 * @returns Mutation hook for updating sprint status
 */
export const useUpdateSprintStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sprintId, isStarted, isCompleted }: { sprintId: string; isStarted?: boolean; isCompleted?: boolean }) =>
      updateSprintStatus(sprintId, { isStarted, isCompleted }),
    onSuccess: (data, variables) => {
      // Response includes complete sprint data
      queryClient.setQueryData(sprintKeys.detail(variables.sprintId), data);
      
      // Update sprints list for the project - match all queries with this projectId
      queryClient.setQueriesData(
        { 
          queryKey: ['sprints', 'list', data.projectId],
          exact: false // Match any query that starts with this key (including those with options)
        },
        (oldData: any) => {
          if (!oldData) return oldData;
          const isArray = Array.isArray(oldData);
          const sprints = isArray ? oldData : (oldData.sprints || []);
          const updatedSprints = sprints.map((sprint: any) => 
            sprint.id === variables.sprintId ? data : sprint
          );
          return isArray ? updatedSprints : { ...oldData, sprints: updatedSprints };
        }
      );
      
      // Also invalidate for consistency (WebSocket will also handle this)
      queryClient.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
};

/**
 * Hook to delete a sprint
 * @returns Mutation hook for deleting sprints
 */
export const useDeleteSprint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => deleteSprint(sprintId),
    onSuccess: () => {
      // Invalidate all sprint lists
      queryClient.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
};

/**
 * Hook to start a sprint
 * @returns Mutation hook for starting sprints
 */
export const useStartSprint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => startSprint(sprintId),
    onSuccess: (data, sprintId) => {
      // Update the specific sprint in cache
      queryClient.setQueryData(sprintKeys.detail(sprintId), data);
      // Invalidate sprints lists
      queryClient.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
};

/**
 * Hook to complete a sprint
 * @returns Mutation hook for completing sprints
 */
export const useCompleteSprint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => completeSprint(sprintId),
    onSuccess: (data, sprintId) => {
      // Update the specific sprint in cache
      queryClient.setQueryData(sprintKeys.detail(sprintId), data);
      // Invalidate sprints lists
      queryClient.invalidateQueries({ queryKey: sprintKeys.lists() });
    },
  });
};


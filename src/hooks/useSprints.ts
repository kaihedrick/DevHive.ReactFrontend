import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectSprints,
  fetchSprintById,
  createSprint,
  updateSprint,
  deleteSprint,
  startSprint,
  completeSprint,
} from '../services/sprintService';

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
  return useQuery({
    queryKey: sprintKeys.list(projectId || '', options),
    queryFn: () => fetchProjectSprints(projectId!, options),
    enabled: !!projectId, // Only run query if projectId is provided
    // No staleTime - uses Infinity from queryClient
  });
};

/**
 * Hook to fetch a single sprint by ID
 * @param sprintId The sprint ID
 * @returns Query result with sprint data
 */
export const useSprint = (sprintId: string | null | undefined) => {
  return useQuery({
    queryKey: sprintKeys.detail(sprintId || ''),
    queryFn: () => fetchSprintById(sprintId!),
    enabled: !!sprintId, // Only run query if sprintId is provided
    // No staleTime - uses Infinity from queryClient
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
      queryClient.setQueriesData(
        { queryKey: sprintKeys.list(variables.projectId) },
        (oldData: any) => {
          if (!oldData) return [data];
          const isArray = Array.isArray(oldData);
          const sprints = isArray ? oldData : (oldData.sprints || []);
          return isArray ? [...sprints, data] : { ...oldData, sprints: [...sprints, data] };
        }
      );
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
      
      // Update sprints list for the project
      queryClient.setQueriesData(
        { queryKey: sprintKeys.list(data.projectId) },
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


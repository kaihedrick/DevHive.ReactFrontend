import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUserProjects,
  fetchProjectById,
  createProject,
  updateProject,
  deleteProject,
  joinProjectByCode,
} from '../services/projectService';

// Query keys
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: any) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

/**
 * Hook to fetch all projects for the authenticated user
 * @param options Pagination options
 * @returns Query result with projects data
 */
export const useProjects = (options?: { limit?: number; offset?: number }) => {
  return useQuery({
    queryKey: projectKeys.list(options),
    queryFn: () => fetchUserProjects(options),
    staleTime: 2 * 60 * 1000, // 2 minutes - projects list changes less frequently
  });
};

/**
 * Hook to fetch a single project by ID
 * @param projectId The project ID
 * @returns Query result with project data
 */
export const useProject = (projectId: string | null | undefined) => {
  return useQuery({
    queryKey: projectKeys.detail(projectId || ''),
    queryFn: () => fetchProjectById(projectId!),
    enabled: !!projectId, // Only run query if projectId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes - project details change less frequently
  });
};

/**
 * Hook to create a new project
 * @returns Mutation hook for creating projects
 */
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectData: { name: string; description?: string }) =>
      createProject(projectData),
    onSuccess: () => {
      // Invalidate projects list to refetch with new project
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
};

/**
 * Hook to update an existing project
 * @returns Mutation hook for updating projects
 */
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, projectData }: { projectId: string; projectData: any }) =>
      updateProject(projectId, projectData),
    onSuccess: (data, variables) => {
      // Update the specific project in cache
      queryClient.setQueryData(projectKeys.detail(variables.projectId), data);
      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
};

/**
 * Hook to delete a project
 * @returns Mutation hook for deleting projects
 */
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      // Invalidate projects list to remove deleted project
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
};

/**
 * Hook to join a project by code
 * @returns Mutation hook for joining projects
 */
export const useJoinProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => joinProjectByCode(projectId),
    onSuccess: (data) => {
      // Invalidate projects list to include newly joined project
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      // Also update the specific project cache if ID is available
      if (data?.id) {
        queryClient.setQueryData(projectKeys.detail(data.id), data);
      }
    },
  });
};

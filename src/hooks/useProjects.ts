import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUserProjects,
  fetchProjectById,
  createProject,
  updateProject,
  deleteProject,
  joinProjectByCode,
  fetchProjectMembers,
  removeProjectMember,
} from '../services/projectService';
import { api } from '../lib/apiClient.ts';
import { ENDPOINTS } from '../config';
import { getUserId } from '../services/authService.ts';

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
    // No staleTime - uses Infinity from queryClient
  });
};

/**
 * Hook to fetch a single project by ID
 * @param projectId The project ID
 * @returns Query result with project data
 */
export const useProject = (projectId: string | null | undefined) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: projectKeys.detail(projectId || ''),
    queryFn: () => fetchProjectById(projectId!),
    enabled: !!projectId, // Only run query if projectId is provided
    // No staleTime - uses Infinity from queryClient
    retry: (failureCount, error: any) => {
      // Don't retry on 403 (forbidden) - user was removed from project
      if (error?.status === 403 || error?.response?.status === 403) {
        // Remove project from projects list cache
        const currentUserId = getUserId();
        if (currentUserId && projectId) {
          queryClient.setQueriesData(
            { 
              queryKey: ['projects', 'list'],
              exact: false
            },
            (oldData: any) => {
              if (!oldData) return oldData;
              const isArray = Array.isArray(oldData);
              const projects = isArray ? oldData : (oldData.projects || []);
              const filteredProjects = projects.filter((project: any) => project.id !== projectId);
              return isArray ? filteredProjects : { ...oldData, projects: filteredProjects };
            }
          );
          // Clear selected project if it's the one being accessed
          const selectedProject = localStorage.getItem('selectedProjectId');
          if (selectedProject === projectId) {
            localStorage.removeItem('selectedProjectId');
          }
        }
        return false; // Don't retry
      }
      return failureCount < 3; // Retry up to 3 times for other errors
    },
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
      createProject({
        name: projectData.name,
        description: projectData.description || "",
      }),
    onSuccess: (data) => {
      // Directly add the new project to the projects list cache
      // Use projectKeys.lists() to match all list queries (with or without options)
      queryClient.setQueriesData(
        { 
          queryKey: projectKeys.lists(),
          exact: false // Match any query that starts with ['projects', 'list']
        },
        (oldData: any) => {
          if (!oldData) return [data];
          const isArray = Array.isArray(oldData);
          const projects = isArray ? oldData : (oldData.projects || []);
          // Add new project to the beginning of the list
          const updatedProjects = [data, ...projects];
          return isArray ? updatedProjects : { ...oldData, projects: updatedProjects };
        }
      );
      
      // Also set the project detail cache
      if (data?.id) {
        queryClient.setQueryData(projectKeys.detail(data.id), data);
      }
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
      
      // Update projects list cache directly
      queryClient.setQueriesData(
        { 
          queryKey: ['projects', 'list'],
          exact: false
        },
        (oldData: any) => {
          if (!oldData) return oldData;
          const isArray = Array.isArray(oldData);
          const projects = isArray ? oldData : (oldData.projects || []);
          const updatedProjects = projects.map((project: any) => 
            project.id === variables.projectId ? data : project
          );
          return isArray ? updatedProjects : { ...oldData, projects: updatedProjects };
        }
      );
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
    onSuccess: (_, projectId) => {
      // Directly remove the project from the projects list cache
      queryClient.setQueriesData(
        { 
          queryKey: projectKeys.lists(),
          exact: false // Match any query that starts with ['projects', 'list']
        },
        (oldData: any) => {
          if (!oldData) return oldData;
          const isArray = Array.isArray(oldData);
          const projects = isArray ? oldData : (oldData.projects || []);
          const filteredProjects = projects.filter((project: any) => project.id !== projectId);
          return isArray ? filteredProjects : { ...oldData, projects: filteredProjects };
        }
      );
      
      // Remove the project detail cache
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
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
      // Update the specific project cache
      if (data?.id) {
        queryClient.setQueryData(projectKeys.detail(data.id), data);
      }
      // Backend WebSocket will handle invalidating projects list
    },
  });
};

/**
 * Hook to leave a project (remove current user from project)
 * @returns Mutation hook for leaving projects
 */
export const useLeaveProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => {
      const currentUserId = getUserId();
      if (!currentUserId) {
        throw new Error('User ID not found');
      }
      return removeProjectMember(projectId, currentUserId);
    },
    onSuccess: (_, projectId) => {
      // Backend WebSocket will send cache invalidation message for project members
      // No need to invalidate here - backend handles it
      
      // Optimistically remove the project from the current user's projects list
      queryClient.setQueriesData(
        { 
          queryKey: ['projects', 'list'],
          exact: false
        },
        (oldData: any) => {
          if (!oldData) return oldData;
          const isArray = Array.isArray(oldData);
          const projects = isArray ? oldData : (oldData.projects || []);
          const filteredProjects = projects.filter((project: any) => project.id !== projectId);
          return isArray ? filteredProjects : { ...oldData, projects: filteredProjects };
        }
      );
      
      // Remove the project detail cache (user can't access it anymore)
      queryClient.removeQueries({ queryKey: projectKeys.detail(projectId) });
      
      // Clear selected project if it's the one being left
      const selectedProject = localStorage.getItem('selectedProjectId');
      if (selectedProject === projectId) {
        localStorage.removeItem('selectedProjectId');
      }
      
      // Backend WebSocket will handle invalidating projects list
    },
  });
};

/**
 * Hook to fetch project members for a project
 * @param projectId The project ID
 * @returns Query result with project members data
 */
export const useProjectMembers = (projectId: string | null | undefined) => {
  return useQuery({
    queryKey: ['projectMembers', projectId],
    queryFn: () => fetchProjectMembers(projectId!),
    enabled: !!projectId, // Only run query if projectId is provided
    staleTime: Infinity, // Explicitly set to Infinity - cache never goes stale
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - cache retention
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect (WebSocket handles this)
  });
};

/**
 * Hook to add a member to a project
 * @returns Mutation hook for adding project members
 */
export const useAddProjectMember = () => {
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      userId, 
      role 
    }: { 
      projectId: string; 
      userId: string; 
      role: string 
    }) => {
      // Backend now validates role and rejects "owner"
      const response = await api.put(
        `${ENDPOINTS.PROJECT_BY_ID(projectId)}/members/${userId}`,
        {},
        { params: { role } }
      );
      return response.data;
    },
    onError: (error: any) => {
      // Handle role validation error
      if (error.response?.status === 400) {
        const message = error.response?.data?.message || error.message;
        if (message.includes("Cannot set role to 'owner'") || message.includes("owner")) {
          console.error("Owner role cannot be assigned via member management");
          // Error will be handled by component using toast/notification
        } else if (message.includes("Invalid role")) {
          console.error("Invalid role. Allowed roles: member, admin, viewer");
        }
      }
      throw error; // Re-throw to allow component handling
    },
    onSuccess: (data, variables) => {
      // Backend WebSocket will send cache invalidation message
      // No need to invalidate here - backend handles it
    },
  });
};

/**
 * Hook to remove a member from a project
 * @returns Mutation hook for removing project members
 */
export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      projectId, 
      userId 
    }: { 
      projectId: string; 
      userId: string; 
    }) => removeProjectMember(projectId, userId),
    onSuccess: (data, variables) => {
      const currentUserId = getUserId();
      
      // Backend WebSocket will send cache invalidation message for project members
      // No need to invalidate here - backend handles it
      
      // If the removed user is the current user, optimistically update projects list
      if (currentUserId && currentUserId === variables.userId) {
        queryClient.setQueriesData(
          { 
            queryKey: ['projects', 'list'],
            exact: false
          },
          (oldData: any) => {
            if (!oldData) return oldData;
            const isArray = Array.isArray(oldData);
            const projects = isArray ? oldData : (oldData.projects || []);
            const filteredProjects = projects.filter((project: any) => project.id !== variables.projectId);
            return isArray ? filteredProjects : { ...oldData, projects: filteredProjects };
          }
        );
        
        // Clear selected project if it's the one being removed from
        const selectedProject = localStorage.getItem('selectedProjectId');
        if (selectedProject === variables.projectId) {
          localStorage.removeItem('selectedProjectId');
        }
        
        // Backend WebSocket will handle invalidating projects list
      }
    },
  });
};

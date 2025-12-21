import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient.ts';
import { projectKeys } from './useProjects.ts';
import { Project } from '../types/hooks.ts';
import { useAuthContext } from '../contexts/AuthContext.tsx';

// Types
export interface Invite {
  id: string;
  projectId: string;
  token: string;
  expiresAt: string;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface InviteDetails {
  invite: Invite;
  project: {
    id: string;
    name: string;
    description: string;
  };
}

export interface CreateInviteRequest {
  expiresInMinutes?: number; // Optional, defaults to 30
  maxUses?: number; // Optional, nil = unlimited
}

export interface InvitesResponse {
  invites: Invite[];
  count: number;
}

// Legacy type aliases for backward compatibility
export type ProjectInvite = Invite;

/**
 * Query: Get invite details by token (public endpoint, no auth required)
 */
export const useInviteDetails = (inviteToken: string | null) => {
  return useQuery<InviteDetails>({
    queryKey: ['invites', inviteToken],
    queryFn: async () => {
      const response = await apiClient.get(`/invites/${inviteToken}`);
      return response.data;
    },
    enabled: !!inviteToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Query: List project invites
 * 
 * IMPORTANT: This query must be independent of transient project loading state.
 * It should fetch based on:
 * - projectId exists (from URL params or localStorage)
 * - User is authenticated
 * 
 * It should NOT depend on:
 * - projects array being loaded
 * - project object being available
 * - transient refetch states
 * 
 * Backend will handle permission checks and return 403 if user doesn't have access.
 */
export const useProjectInvites = (projectId: string | null, project: Project | null | undefined) => {
  const { isAuthenticated } = useAuthContext();
  
  // Determine if permissions explicitly forbid fetching
  // Only skip if permissions are explicitly set to false
  // Otherwise, fetch and let backend handle permission validation
  const canViewInvites = project?.permissions?.canViewInvites;
  const explicitlyForbidden = canViewInvites === false;
  
  // Fetch if:
  // - projectId exists (required)
  // - AND user is authenticated
  // - AND permissions don't explicitly forbid (canViewInvites !== false)
  // 
  // CRITICAL: Don't gate on project object being loaded - it can be temporarily unavailable during refetches
  // When project is undefined during refetch, canViewInvites is undefined, so we still fetch
  const shouldFetch = !!projectId && isAuthenticated && !explicitlyForbidden;
  
  return useQuery<InvitesResponse>({
    queryKey: ['projects', projectId, 'invites'],
    queryFn: async () => {
      console.log(`📡 Fetching invites for project ${projectId}`);
      const response = await apiClient.get(`/projects/${projectId}/invites`);
      console.log(`✅ Invites fetched successfully:`, response.data);
      return response.data;
    },
    enabled: shouldFetch, // Fetch based on projectId and auth, not project object state
    staleTime: Infinity, // Cache indefinitely - only invalidate when invites change
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - cache retention
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect (WebSocket handles this)
    retry: (failureCount, error: any) => {
      // Don't retry on 403 (forbidden) - user doesn't have permission
      if (error?.status === 403 || error?.response?.status === 403) {
        // This is expected for members without permission
        console.log('User does not have permission to view invites');
        return false; // Don't retry
      }
      return failureCount < 3; // Retry up to 3 times for other errors
    },
  });
};

/**
 * Mutation: Create invite
 */
export const useCreateInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      data
    }: {
      projectId: string;
      data: CreateInviteRequest;
    }) => {
      const response = await apiClient.post(`/projects/${projectId}/invites`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate invites list for the project
      queryClient.invalidateQueries({
        queryKey: ['projects', variables.projectId, 'invites']
      });
    },
  });
};

/**
 * Mutation: Revoke invite
 */
export const useRevokeInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      inviteId
    }: {
      projectId: string;
      inviteId: string;
    }) => {
      await apiClient.delete(`/projects/${projectId}/invites/${inviteId}`);
    },
    onSuccess: (_, variables) => {
      // Invalidate invites list for the project
      queryClient.invalidateQueries({
        queryKey: ['projects', variables.projectId, 'invites']
      });
    },
  });
};

/**
 * Mutation: Accept invite
 */
export const useAcceptInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteToken: string) => {
      const response = await apiClient.post(`/invites/${inviteToken}/accept`);
      return response.data;
    },
    onSuccess: (project) => {
      // Directly update the projects list cache with the new project
      queryClient.setQueriesData(
        { 
          queryKey: ['projects', 'list'],
          exact: false // Match any query that starts with this key (including those with options)
        },
        (oldData: any) => {
          if (!oldData) {
            // If no existing data, return array with the new project
            return [project];
          }
          
          const isArray = Array.isArray(oldData);
          const projects = isArray ? oldData : (oldData.projects || []);
          
          // Check if project already exists in the list
          const projectExists = projects.some((p: any) => p.id === project.id);
          
          if (projectExists) {
            // Update existing project
            const updatedProjects = projects.map((p: any) => 
              p.id === project.id ? project : p
            );
            return isArray ? updatedProjects : { ...oldData, projects: updatedProjects };
          } else {
            // Add new project to the list
            const updatedProjects = [...projects, project];
            return isArray ? updatedProjects : { ...oldData, projects: updatedProjects };
          }
        }
      );
      
      // CRITICAL FIX: Set project detail cache optimistically first
      // This ensures the project is available immediately when navigating to project-details
      // Even though it may be incomplete (missing members), it's better than "project not found"
      if (project?.id) {
        // Set project detail cache optimistically (may be incomplete, but prevents "not found" error)
        // Use the same query key structure as useProject hook to ensure consistency
        queryClient.setQueryData(projectKeys.detail(project.id), project);
        
        // Refetch in the background WITHOUT invalidating first
        // This ensures the optimistic data is shown immediately, and fresh data replaces it when ready
        // Using a small delay to ensure the backend has processed the membership
        setTimeout(() => {
          queryClient.refetchQueries({ 
            queryKey: projectKeys.detail(project.id),
            type: 'active' // Only refetch if component is using it
          });
          
          // Also refetch project members in the background
          queryClient.refetchQueries({ 
            queryKey: ['projectMembers', project.id],
            type: 'active' // Only refetch if component is using it
          });
        }, 500); // Small delay to allow backend to fully process membership
      }
      
      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      // Invalidate invite details
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
};


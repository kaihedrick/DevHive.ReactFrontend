import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createProjectInvite,
  fetchProjectInvites,
  revokeProjectInvite,
  getInviteByToken,
  acceptInvite
} from '../services/projectService';

// Query keys
export const inviteKeys = {
  all: ['invites'] as const,
  lists: () => [...inviteKeys.all, 'list'] as const,
  list: (projectId: string) => [...inviteKeys.lists(), projectId] as const,
  detail: (token: string) => [...inviteKeys.all, 'detail', token] as const,
};

// Types
export interface ProjectInvite {
  id: string;
  inviteToken: string;
  inviteUrl: string;
  projectId: string;
  createdBy: string;
  expiresAt: string;
  maxUses?: number;
  useCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface InviteDetails {
  projectId: string;
  projectName: string;
  expiresAt: string;
  isExpired: boolean;
  isValid: boolean;
}

export interface InvitesResponse {
  invites: ProjectInvite[];
  count: number;
}

/**
 * Hook to fetch all invites for a project
 */
export const useProjectInvites = (projectId: string) => {
  return useQuery({
    queryKey: inviteKeys.list(projectId),
    queryFn: () => fetchProjectInvites(projectId),
    enabled: !!projectId,
    staleTime: Infinity,
  });
};

/**
 * Hook to get invite details by token (public)
 */
export const useInviteDetails = (token: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: inviteKeys.detail(token),
    queryFn: () => getInviteByToken(token),
    enabled: enabled && !!token,
    staleTime: Infinity,
  });
};

/**
 * Hook to create a new invite
 */
export const useCreateInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      expiresInMinutes,
      maxUses
    }: {
      projectId: string;
      expiresInMinutes?: number;
      maxUses?: number;
    }) => createProjectInvite(projectId, { expiresInMinutes, maxUses }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: inviteKeys.list(variables.projectId) });
    },
  });
};

/**
 * Hook to revoke an invite
 */
export const useRevokeInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      inviteId
    }: {
      projectId: string;
      inviteId: string;
    }) => revokeProjectInvite(projectId, inviteId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: inviteKeys.list(variables.projectId) });
    },
  });
};

/**
 * Hook to accept an invite
 */
export const useAcceptInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvite(token),
    onSuccess: () => {
      // Invalidate project lists and member lists to reflect new membership
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['projectMembers'] });
    },
  });
};


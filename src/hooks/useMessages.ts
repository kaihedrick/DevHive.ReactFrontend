import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectMessages,
  sendMessage,
} from '../services/messageService';
import { useAuthContext } from '../contexts/AuthContext.tsx';

// Query keys
export const messageKeys = {
  all: ['messages'] as const,
  lists: () => [...messageKeys.all, 'list'] as const,
  project: (projectId: string) => [...messageKeys.lists(), 'project', projectId] as const,
};

/**
 * Hook to fetch messages for a project
 * @param projectId The project ID
 * @param options Pagination options
 * @returns Query result with messages data
 */
export const useMessages = (projectId: string | null | undefined, options?: { limit?: number; offset?: number }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  
  return useQuery({
    queryKey: messageKeys.project(projectId || ''),
    queryFn: () => fetchProjectMessages(projectId!, options),
    enabled: !!projectId && isAuthenticated && !authLoading, // ✅ Only fetch when authenticated AND auth is initialized
    staleTime: Infinity, // Messages are updated via WebSocket, no need to refetch automatically
    // Removed refetchInterval - WebSocket handles real-time updates via cache invalidation
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
 * Hook to send a message
 * @returns Mutation hook for sending messages
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageData: { projectId: string; content: string; messageType?: string; parentMessageId?: string }) =>
      sendMessage(messageData),
    onSuccess: (data, variables) => {
      // Invalidate messages list for the project to show new message
      queryClient.invalidateQueries({ queryKey: messageKeys.project(variables.projectId) });
    },
  });
};

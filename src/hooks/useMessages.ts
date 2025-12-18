import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectMessages,
  sendMessage,
} from '../services/messageService';

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
  return useQuery({
    queryKey: messageKeys.project(projectId || ''),
    queryFn: () => fetchProjectMessages(projectId!, options),
    enabled: !!projectId, // Only run query if projectId is provided
    staleTime: 30 * 1000, // 30 seconds - messages are more real-time
    refetchInterval: 60 * 1000, // Refetch every minute for real-time feel
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

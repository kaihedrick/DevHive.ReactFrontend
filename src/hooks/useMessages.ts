import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectMessages,
  sendMessage,
} from '../services/messageService';
import { useAuthContext } from '../contexts/AuthContext.tsx';
import { Message } from '../types/hooks.ts';
import { getUserId } from '../services/authService.ts';

// Query keys for React Query cache management
export const messageKeys = {
  all: ['messages'] as const,
  lists: () => [...messageKeys.all, 'list'] as const,
  project: (projectId: string) => [...messageKeys.lists(), 'project', projectId] as const,
};

/**
 * Hook to fetch messages for a project using React Query
 * Used internally and can be exported for direct use
 *
 * @param projectId The project ID
 * @param options Pagination options
 * @returns Query result with messages data
 */
export const useMessagesQuery = (projectId: string | null | undefined, options?: { limit?: number; offset?: number }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();

  return useQuery({
    queryKey: messageKeys.project(projectId || ''),
    queryFn: () => fetchProjectMessages(projectId!, options),
    enabled: !!projectId && isAuthenticated && !authLoading,
    staleTime: Infinity, // Messages are updated via WebSocket cache invalidation
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
 * Hook to send a message using React Query mutation
 * @returns Mutation hook for sending messages
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageData: { projectId: string; content: string; messageType?: string; parentMessageId?: string }) =>
      sendMessage(messageData),
    onSuccess: (_data, variables) => {
      // Invalidate messages list for the project to show new message
      queryClient.invalidateQueries({ queryKey: messageKeys.project(variables.projectId) });
    },
  });
};

/**
 * Complete hook for messaging UI with state management
 *
 * Provides all state and handlers needed by the Message component:
 * - Messages list (from React Query)
 * - Input state management
 * - Send message handler with optimistic updates
 * - Auto-scroll ref
 * - Loading/error states
 *
 * Architecture (per REALTIME_MESSAGING_ARCHITECTURE.md):
 * - Messages are sent via REST API (POST /api/v1/projects/{projectId}/messages)
 * - WebSocket broadcasts cache_invalidate to all project members
 * - React Query cache is invalidated, triggering refetch
 *
 * @param projectId The project ID for messages
 * @returns Complete messaging state and handlers
 */
export const useMessages = (projectId: string | null | undefined) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const loggedInUserId = getUserId();

  // Fetch messages using React Query
  const {
    data: messagesData,
    isLoading,
    error,
    refetch
  } = useMessagesQuery(projectId);

  // Send message mutation
  const sendMutation = useSendMessage();

  // Extract messages array from response, normalize senderId to userId for component compatibility
  const messages: Message[] = (messagesData?.messages || []).map((msg: Message) => ({
    ...msg,
    userId: msg.senderId, // Map senderId to userId for component compatibility
  }));

  /**
   * Handle sending a new message
   * Uses React Query mutation with cache invalidation
   */
  const handleSendMessage = useCallback(async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !projectId || sendMutation.isPending) return;

    try {
      await sendMutation.mutateAsync({
        projectId,
        content: trimmedMessage,
        messageType: 'text',
      });

      // Clear input on success
      setNewMessage('');

      // Refetch messages to get the new one (WebSocket will also trigger this)
      refetch();
    } catch (error) {
      console.error('❌ Error sending message:', error);
      // Error is available via sendMutation.error
    }
  }, [newMessage, projectId, sendMutation, refetch]);

  return {
    // Messages data
    messages,

    // Input state
    newMessage,
    setNewMessage,

    // Send handler
    handleSendMessage,

    // Auto-scroll ref
    messagesEndRef,

    // Loading states
    loading: isLoading,
    sending: sendMutation.isPending,

    // Error states
    error: error ? (error as Error).message : null,
    sendError: sendMutation.error ? (sendMutation.error as Error).message : null,

    // Logged in user for determining sent/received
    loggedInUserId,

    // Refetch function for manual refresh
    refetch,
  };
};

// Default export for backward compatibility with legacy imports
export default useMessages;

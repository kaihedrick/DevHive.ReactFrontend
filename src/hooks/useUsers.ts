import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserById, updateUserProfile } from '../services/userService.ts';
import { UserModel } from '../models/user.ts';
import { useAuthContext } from '../contexts/AuthContext.tsx';

/**
 * Hook to fetch a single user by ID
 * @param userId The user ID
 * @returns Query result with user data
 */
export const useUser = (userId: string | null | undefined) => {
  const { userId: currentUserId, isLoading: authLoading, authInitialized } = useAuthContext();
  
  // Task 4.2: Guard queries - early exit if no currentUserId
  // CRITICAL: Also wait for authInitialized to prevent queries during bootstrap
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUserById(userId!),
    enabled: !!userId && !!currentUserId && !authLoading && authInitialized, // ✅ Only fetch when authenticated AND auth is initialized
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
 * Hook to update user profile
 * @returns Mutation hook for updating user profile
 */
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, userData, originalUser }: { userId: string; userData: Partial<UserModel>; originalUser?: UserModel }) =>
      updateUserProfile(userData, originalUser),
    onSuccess: (data, variables) => {
      // Update user cache
      queryClient.setQueryData(['user', variables.userId], data);
      // Invalidate user queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['user', variables.userId] });
    },
  });
};



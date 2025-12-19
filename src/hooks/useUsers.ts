import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserById, updateUserProfile } from '../services/userService.ts';
import { UserModel } from '../models/user.ts';

/**
 * Hook to fetch a single user by ID
 * @param userId The user ID
 * @returns Query result with user data
 */
export const useUser = (userId: string | null | undefined) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUserById(userId!),
    enabled: !!userId, // Only run query if userId is provided
    // No staleTime - uses Infinity from queryClient
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



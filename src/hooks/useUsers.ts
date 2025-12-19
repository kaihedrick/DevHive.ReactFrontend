import { useQuery } from '@tanstack/react-query';
import { fetchUserById } from '../services/userService';

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


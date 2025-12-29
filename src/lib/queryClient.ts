import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient, type Persister } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Create QueryClient with caching configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Cache never goes stale - invalidate only via WebSocket
      gcTime: 24 * 60 * 60 * 1000, // 24 hours - cache retention (formerly cacheTime)
      refetchOnWindowFocus: false, // Prevent refetch on tab focus
      refetchOnReconnect: false, // Prevent refetch on network reconnect (WebSocket handles this)
      refetchOnMount: false, // Prevent refetch on component mount if data exists
      retry: 1, // Retry failed requests once
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 0, // Don't retry mutations
    },
  },
});

// Track current persister and user
let currentPersister: ReturnType<typeof createSyncStoragePersister> | null = null;
let currentUserId: string | null = null;

/**
 * Sets up user-scoped cache persistence.
 * Each user gets their own isolated cache in localStorage.
 * This prevents cache leakage between users during login/logout/OAuth flows.
 *
 * @param userId - The user ID to scope the cache to
 */
export function setupUserScopedPersistence(userId: string): void {
  // Don't reinitialize if already set up for this user
  if (currentUserId === userId && currentPersister) {
    console.log('✅ Cache persistence already set up for user:', userId);
    return;
  }

  // Clean up previous user's cache from localStorage
  if (currentUserId && currentUserId !== userId) {
    console.log('🧹 Cleaning up previous cache for user:', currentUserId);
    const oldKey = `REACT_QUERY_OFFLINE_CACHE:${currentUserId}`;
    localStorage.removeItem(oldKey);
  }

  console.log('🔧 Setting up user-scoped cache persistence for user:', userId);

  // Create user-scoped persister
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: `REACT_QUERY_OFFLINE_CACHE:${userId}`,
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  });

  // Set up persistence
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    buster: '', // Cache version - increment to bust cache
    dehydrateOptions: {
      // Only persist queries that have data
      shouldDehydrateQuery: (query) => {
        return query.state.data !== undefined;
      },
    },
  });

  currentPersister = persister;
  currentUserId = userId;

  console.log('✅ User-scoped cache persistence active');
}

/**
 * Clears user-scoped cache persistence.
 * Called on logout to clean up the persister.
 */
export function clearUserScopedPersistence(): void {
  // Clear the user-scoped cache from localStorage
  if (currentUserId) {
    const key = `REACT_QUERY_OFFLINE_CACHE:${currentUserId}`;
    localStorage.removeItem(key);
    console.log('🗑️ Removed user-scoped cache from localStorage:', key);
  }

  currentPersister = null;
  currentUserId = null;
  console.log('✅ Cache persistence cleared');
}

/**
 * Removes cache for a specific user from localStorage.
 * Useful for cleanup without affecting the current persister.
 *
 * @param userId - The user ID whose cache should be removed
 */
export function removeUserCache(userId: string): void {
  const key = `REACT_QUERY_OFFLINE_CACHE:${userId}`;
  localStorage.removeItem(key);
  console.log('🗑️ Removed cache for user:', userId);
}

/**
 * Removes the legacy unscoped cache from localStorage.
 * Should be called once to clean up old cache format.
 */
export function removeLegacyCache(): void {
  localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
  console.log('🗑️ Removed legacy unscoped cache');
}

export default queryClient;


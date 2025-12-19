import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
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

// Create localStorage persister
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

// Persist query client to localStorage
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  buster: '', // Cache version - increment to bust cache
  dehydrateOptions: {
    // Only persist queries that have data
    shouldDehydrateQuery: (query) => {
      return query.state.data !== undefined;
    },
  },
});

export default queryClient;


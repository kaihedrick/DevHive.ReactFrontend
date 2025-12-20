import { useEffect } from 'react';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
import { useAuthContext } from '../contexts/AuthContext.tsx';

/**
 * Hook to ensure WebSocket connection is active when viewing a project.
 * 
 * NOTE: AuthContext is the SINGLE OWNER of WebSocket connections.
 * This hook is a no-op - it exists for backward compatibility only.
 * 
 * The backend broadcasts cache invalidation messages to clients connected
 * to a specific project. AuthContext manages the connection based on
 * the selected project in localStorage.
 * 
 * @param projectId - The project ID (unused, kept for API compatibility)
 * @deprecated AuthContext now manages all WebSocket connections
 */
export const useProjectWebSocket = (projectId: string | undefined | null) => {
  const { isAuthenticated } = useAuthContext();

  useEffect(() => {
    // AuthContext is the single owner of WebSocket connections
    // It connects based on selectedProjectId in localStorage
    // This hook does nothing to avoid conflicts
    // 
    // If you need to ensure a connection, make sure:
    // 1. User is authenticated (handled by AuthContext)
    // 2. Project is selected in localStorage (handled by AuthContext)
    // 
    // No cleanup needed - AuthContext handles disconnection on logout
  }, [projectId, isAuthenticated]);
};


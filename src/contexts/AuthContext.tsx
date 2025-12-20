import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login as loginService, logout as logoutService, refreshToken as refreshTokenService, getUserId, AuthToken } from '../services/authService.ts';
import { LoginModel } from '../models/user.ts';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
import { getSelectedProject, clearSelectedProject } from '../services/storageService';
import { getAccessToken, isTokenExpiredBeyondWindow, isTokenExpired } from '../lib/apiClient.ts';
import { useValidateProjectAccess } from '../hooks/useValidateProjectAccess.ts';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  isLoading: boolean;
  login: (credentials: LoginModel | any) => Promise<AuthToken>;
  logout: () => void;
  refreshToken: () => Promise<AuthToken>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const previousProjectIdRef = useRef<string | null>(null);
  const { validateProjectId, isLoading: projectsLoading, projects: projectsData } = useValidateProjectAccess();
  
  // Extract projects array from response
  const projects = Array.isArray(projectsData) 
    ? projectsData 
    : (projectsData?.projects || []);

  // Register callback for 403 Forbidden errors from WebSocket
  useEffect(() => {
    cacheInvalidationService.setOnForbiddenCallback((projectId: string) => {
      console.warn('⚠️ WebSocket 403 Forbidden callback triggered for project:', projectId);
      // Clear invalid projectId (scoped to current user)
      const currentUserId = getUserId();
      clearSelectedProject(currentUserId);
      previousProjectIdRef.current = null;
    });

    return () => {
      // Cleanup callback on unmount
      cacheInvalidationService.setOnForbiddenCallback(null);
    };
  }, []);
  
  // Initialize state from localStorage immediately to avoid race conditions
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const hasToken = !!localStorage.getItem('token');
    const hasUserId = !!getUserId();
    return hasToken && hasUserId;
  });
  const [userId, setUserId] = useState<string | null>(() => getUserId());
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Check for existing auth state on mount
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const storedUserId = getUserId();
        const hasToken = !!localStorage.getItem('token');

        if (hasToken && storedUserId) {
          // Check if token is expired beyond 24-hour window
          if (isTokenExpiredBeyondWindow()) {
            console.log('⚠️ Token expired beyond 24-hour window, clearing auth state');
            setIsAuthenticated(false);
            setUserId(null);
            logoutService();
            setIsInitializing(false);
            return;
          }

          // Check if token is expired but within 24-hour window
          if (isTokenExpired()) {
            console.log('⚠️ Token expired but within 24-hour window, attempting refresh');
            try {
              await refreshTokenService();
              setIsAuthenticated(true);
              setUserId(storedUserId);
            } catch (error) {
              // Refresh failed - check if it's a 401 (refresh token invalid)
              const is401 = error?.response?.status === 401 || (error as any)?.status === 401;
              if (is401) {
                console.log('⚠️ Refresh token invalid, clearing auth state');
                setIsAuthenticated(false);
                setUserId(null);
                logoutService();
              } else {
                console.error('❌ Unexpected error during token refresh:', error);
                // Keep authenticated state if we have a valid access token
                setIsAuthenticated(true);
                setUserId(storedUserId);
              }
            }
          } else {
            // Token is valid
            setIsAuthenticated(true);
            setUserId(storedUserId);
          }
        } else {
          setIsAuthenticated(false);
          setUserId(null);
        }
      } catch (error) {
        console.error('❌ Error checking auth state:', error);
        setIsAuthenticated(false);
        setUserId(null);
      } finally {
        setIsInitializing(false);
      }
    };

    checkAuthState();
  }, []);

  // SINGLE OWNER: Connect cache invalidation WebSocket when authenticated with project selected
  // Only connects on: login (isAuthenticated change) or project change
  // Disconnects on: logout or project cleared
  // NOTE: Reconnection on network errors is handled by cacheInvalidationService internally
  useEffect(() => {
    if (!isAuthenticated || isInitializing) {
      // Disconnect on logout or during initialization
      cacheInvalidationService.disconnect('User not authenticated');
      previousProjectIdRef.current = null;
      return;
    }

    // Get selectedProjectId scoped to current user
    const currentUserId = getUserId();
    const selectedProjectId = getSelectedProject(currentUserId);
    if (!selectedProjectId) {
      // Disconnect if no project selected
      cacheInvalidationService.disconnect('No project selected');
      previousProjectIdRef.current = null;
      return;
    }

    // CRITICAL: Only validate if projects are fully loaded
    // If projects are still loading, defer validation and connection
    // This prevents false negatives that would clear valid project selections
    if (projectsLoading) {
      console.log('⏳ Projects still loading, deferring WebSocket connection for:', selectedProjectId);
      return;
    }

    // CRITICAL: Connection strategy - make it deterministic based on selectedProjectId
    // 
    // Strategy:
    // 1. If projects are loaded (not loading) and we have selectedProjectId:
    //    - If projects array has data → validate, connect if valid, clear if invalid
    //    - If projects array is empty → connect anyway (trust stored selection, ignore transient empty state)
    // 2. This ensures connection happens deterministically when projects are loaded,
    //    regardless of transient array state during refetches
    if (projects.length > 0) {
      // Projects are available - validate before connecting
      const isValid = validateProjectId(selectedProjectId);
      if (!isValid) {
        // Projects are loaded and not empty, but projectId not found → truly invalid
        console.warn('⚠️ Selected projectId is not accessible, clearing selection:', {
          projectId: selectedProjectId,
          availableProjects: projects.map((p: any) => ({ id: p.id, name: p.name, userRole: p.userRole }))
        });
        clearSelectedProject(currentUserId);
        cacheInvalidationService.disconnect('Project not accessible');
        previousProjectIdRef.current = null;
        return;
      }
      
      // Validation passed - log for debugging
      const validatedProject = projects.find((p: any) => p.id === selectedProjectId);
      console.log('✅ ProjectId validated, proceeding with WebSocket connection:', {
        projectId: selectedProjectId,
        projectName: validatedProject?.name,
        userRole: validatedProject?.userRole,
        projectsCount: projects.length
      });
    } else {
      // Projects array is empty but projects are loaded (not loading)
      // This could be transient refetch state - trust the stored selectedProjectId and connect
      // This makes connection deterministic and prevents constant deferrals
      console.log('✅ Projects loaded but array is empty (likely transient refetch), connecting with stored projectId:', selectedProjectId);
    }

    // Only connect if project changed or not connected
    // Don't reconnect if already connected to the same project (service handles this)
    const connectWebSocket = async () => {
      if (previousProjectIdRef.current !== selectedProjectId) {
        // Project changed - disconnect old and connect to new
        if (previousProjectIdRef.current !== null) {
          console.log('🔄 Project changed, reconnecting cache invalidation WebSocket');
          cacheInvalidationService.disconnect('Project changed');
        }
        previousProjectIdRef.current = selectedProjectId;
        try {
          await cacheInvalidationService.connect(selectedProjectId);
        } catch (error: any) {
          // Handle 403 Forbidden - clear invalid projectId
          if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
            console.error('❌ Not authorized for project, clearing selection');
            const currentUserId = getUserId();
            clearSelectedProject(currentUserId);
            previousProjectIdRef.current = null;
          }
          console.error('❌ Failed to connect WebSocket:', error);
        }
      } else if (!cacheInvalidationService.isConnected()) {
        // Same project but not connected - connect (e.g., after page refresh)
        try {
          await cacheInvalidationService.connect(selectedProjectId);
        } catch (error: any) {
          // Handle 403 Forbidden - clear invalid projectId
          if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
            console.error('❌ Not authorized for project, clearing selection');
            const currentUserId = getUserId();
            clearSelectedProject(currentUserId);
            previousProjectIdRef.current = null;
          }
          console.error('❌ Failed to connect WebSocket:', error);
        }
      }
    };

    connectWebSocket();
  }, [isAuthenticated, isInitializing, projectsLoading, validateProjectId, projects]);

  // Listen for project selection changes via storage events (cross-tab communication)
  useEffect(() => {
    if (!isAuthenticated || projectsLoading) return;

    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === 'selectedProjectId') {
        const newProjectId = e.newValue;
        const oldProjectId = previousProjectIdRef.current;
        
        if (newProjectId !== oldProjectId) {
          if (oldProjectId !== null) {
            cacheInvalidationService.disconnect('Project changed via storage event');
          }
          
          // Validate new projectId before connecting
          const currentUserId = getUserId();
          if (newProjectId && validateProjectId(newProjectId)) {
            previousProjectIdRef.current = newProjectId;
            try {
              await cacheInvalidationService.connect(newProjectId);
            } catch (error: any) {
              // Handle 403 Forbidden - clear invalid projectId
              if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
                console.error('❌ Not authorized for project, clearing selection');
                clearSelectedProject(currentUserId);
                previousProjectIdRef.current = null;
              }
              console.error('❌ Failed to connect WebSocket:', error);
            }
          } else if (newProjectId) {
            // Invalid projectId - clear it (only if projects are loaded)
            if (!projectsLoading) {
              console.warn('⚠️ Invalid projectId from storage event, clearing:', newProjectId);
              clearSelectedProject(currentUserId);
            }
            previousProjectIdRef.current = null;
          } else {
            previousProjectIdRef.current = null;
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated, projectsLoading, validateProjectId]);

  // WebSocket maintains connection and handles cache invalidation
  // No need to invalidate on visibility change

  const login = useCallback(async (credentials: LoginModel | any): Promise<AuthToken> => {
    try {
      const result = await loginService(credentials);
      // Ensure we have userId from the result
      const userId = result.userId || result.user_id || localStorage.getItem('userId');
      setIsAuthenticated(true);
      setUserId(userId);
      // Return in AuthToken format
      return { Token: result.token || result.Token, userId };
    } catch (error) {
      setIsAuthenticated(false);
      setUserId(null);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    // Disconnect cache invalidation WebSocket with explicit reason
    // This ensures all timers are cleared and no reconnection attempts happen
    cacheInvalidationService.disconnect('User logout');
    previousProjectIdRef.current = null;
    
    // Clear selected project for current user before logout
    const currentUserId = getUserId();
    if (currentUserId) {
      clearSelectedProject(currentUserId);
    }
    
    logoutService();
    setIsAuthenticated(false);
    setUserId(null);
    // Clear all cached queries
    queryClient.clear();
  }, [queryClient]);

  const refreshToken = useCallback(async (): Promise<AuthToken> => {
    try {
      const result = await refreshTokenService();
      setIsAuthenticated(true);
      setUserId(result.userId);
      return result;
    } catch (error) {
      setIsAuthenticated(false);
      setUserId(null);
      throw error;
    }
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    userId,
    isLoading: isInitializing,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


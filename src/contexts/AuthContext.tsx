import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login as loginService, logout as logoutService, refreshToken as refreshTokenService, getUserId, AuthToken } from '../services/authService.ts';
import { LoginModel } from '../models/user.ts';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
import { getSelectedProject, clearSelectedProject } from '../services/storageService';
import { refreshToken as refreshTokenApi } from '../lib/apiClient.ts';

type AuthState = 'unknown' | 'authenticated' | 'unauthenticated';

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
  const isConnectingRef = useRef<boolean>(false);
  const validatedProjectIdRef = useRef<string | null>(null);
  const selectedProjectIdRef = useRef<string | null>(null);

  // Auth state machine: unknown -> authenticated | unauthenticated
  const [authState, setAuthState] = useState<AuthState>('unknown');
  const [userId, setUserId] = useState<string | null>(null);

  // Derived values for backward compatibility
  const isAuthenticated = authState === 'authenticated';
  const isLoading = authState === 'unknown';

  // Direct validation without triggering queries - reads from cache only
  const validateProjectIdFromCache = useCallback((projectId: string): boolean => {
    const cached = queryClient.getQueryData(['projects', 'list']) as any;
    const projects = Array.isArray(cached) ? cached : (cached?.projects || []);
    
    if (projects.length === 0) {
      // No projects cached - assume valid (don't clear on empty cache)
      return true;
    }
    
    return projects.some((p: any) => p.id === projectId);
  }, [queryClient]);

  // Register callback for 403 Forbidden errors from WebSocket
  useEffect(() => {
    cacheInvalidationService.setOnForbiddenCallback((projectId: string) => {
      console.warn('⚠️ WebSocket 403 Forbidden callback triggered for project:', projectId);
      const currentUserId = getUserId();
      if (currentUserId) {
        clearSelectedProject(currentUserId);
      }
      previousProjectIdRef.current = null;
    });

    return () => {
      cacheInvalidationService.setOnForbiddenCallback(null);
    };
  }, []);

  // Phase 3.2: Simple initialization - call /auth/refresh on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth state...');
        await refreshTokenApi();
        
        // Refresh succeeded - get userId from localStorage (set by refreshToken)
        const refreshedUserId = getUserId();
        if (refreshedUserId) {
          setAuthState('authenticated');
          setUserId(refreshedUserId);
          console.log('✅ Auth initialized: authenticated');
        } else {
          // No userId after refresh - should not happen, but handle gracefully
          setAuthState('unauthenticated');
          setUserId(null);
          console.log('⚠️ Auth initialized: no userId found');
        }
      } catch (error: any) {
        const is401 = error?.response?.status === 401;
        if (is401) {
          // Refresh token expired/invalid
          setAuthState('unauthenticated');
          setUserId(null);
          console.log('✅ Auth initialized: unauthenticated (401)');
        } else {
          // Network error - treat as unauthenticated for now
          setAuthState('unauthenticated');
          setUserId(null);
          console.log('⚠️ Auth initialized: unauthenticated (network error)');
        }
      }
    };

    initializeAuth();
  }, []);

  // WebSocket Connection Management Effect (simplified)
  useEffect(() => {
    // Only connect when authenticated and projectId exists
    if (authState !== 'authenticated') {
      // Not authenticated - disconnect if connected
      if (cacheInvalidationService.isConnected()) {
        cacheInvalidationService.disconnect('Not authenticated');
        previousProjectIdRef.current = null;
        validatedProjectIdRef.current = null;
        isConnectingRef.current = false;
      }
      return;
    }

    const currentUserId = getUserId();
    const selectedProjectId = getSelectedProject(currentUserId);
    
    // Update stable ref only if projectId actually changed
    if (selectedProjectIdRef.current !== selectedProjectId) {
      selectedProjectIdRef.current = selectedProjectId;
    }
    
    if (!selectedProjectId) {
      // Disconnect if no project selected
      if (cacheInvalidationService.isConnected()) {
        cacheInvalidationService.disconnect('No project selected');
      }
      previousProjectIdRef.current = null;
      validatedProjectIdRef.current = null;
      isConnectingRef.current = false;
      return;
    }

    // Prevent clearing projectId while WebSocket is connecting
    if (isConnectingRef.current && validatedProjectIdRef.current === selectedProjectId) {
      return;
    }

    // Validate using cache-only check
    const isValid = validateProjectIdFromCache(selectedProjectId);
    if (!isValid && !isConnectingRef.current) {
      const cached = queryClient.getQueryData(['projects', 'list']) as any;
      const projects = Array.isArray(cached) ? cached : (cached?.projects || []);
      
      console.warn('⚠️ Selected projectId not in cache, clearing selection:', {
        projectId: selectedProjectId,
        cachedProjectsCount: projects.length
      });
      if (currentUserId) {
        clearSelectedProject(currentUserId);
      }
      cacheInvalidationService.disconnect('Project not accessible');
      previousProjectIdRef.current = null;
      validatedProjectIdRef.current = null;
      return;
    }
    
    if (isValid) {
      validatedProjectIdRef.current = selectedProjectId;
    }

    // Connect WebSocket
    const connectWebSocket = async () => {
      if (previousProjectIdRef.current !== selectedProjectId) {
        // Project changed - disconnect old and connect to new
        if (previousProjectIdRef.current !== null) {
          console.log('🔄 Project changed, reconnecting cache invalidation WebSocket');
          cacheInvalidationService.disconnect('Project changed');
        }
        previousProjectIdRef.current = selectedProjectId;
        isConnectingRef.current = true;
        try {
          await cacheInvalidationService.connect(selectedProjectId);
          console.log('✅ WebSocket connected for project:', selectedProjectId);
          isConnectingRef.current = false;
        } catch (error: any) {
          isConnectingRef.current = false;
          if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
            console.error('❌ Not authorized for project, clearing selection');
            if (currentUserId) {
              clearSelectedProject(currentUserId);
            }
            previousProjectIdRef.current = null;
            validatedProjectIdRef.current = null;
          }
          console.error('❌ Failed to connect WebSocket:', error);
        }
      } else if (!cacheInvalidationService.isConnected()) {
        // Same project but not connected - connect
        console.log('🔌 Connecting WebSocket for project:', selectedProjectId);
        isConnectingRef.current = true;
        try {
          await cacheInvalidationService.connect(selectedProjectId);
          console.log('✅ WebSocket connected for project:', selectedProjectId);
          isConnectingRef.current = false;
        } catch (error: any) {
          isConnectingRef.current = false;
          if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
            console.error('❌ Not authorized for project, clearing selection');
            if (currentUserId) {
              clearSelectedProject(currentUserId);
            }
            previousProjectIdRef.current = null;
            validatedProjectIdRef.current = null;
          }
          console.error('❌ Failed to connect WebSocket:', error);
        }
      }
    };

    connectWebSocket();
  }, [authState, validateProjectIdFromCache, queryClient]);

  // Listen for project selection changes via storage events (cross-tab communication)
  useEffect(() => {
    if (authState !== 'authenticated') return;

    const handleStorageChange = async (e: StorageEvent) => {
      const currentUserId = getUserId();
      const key = `selectedProjectId:${currentUserId}`;
      
      if (e.key === key || e.key === 'selectedProjectId') {
        const newProjectId = e.newValue;
        const oldProjectId = previousProjectIdRef.current;
        
        if (newProjectId !== oldProjectId) {
          if (oldProjectId !== null) {
            cacheInvalidationService.disconnect('Project changed via storage event');
          }
          
          if (newProjectId && validateProjectIdFromCache(newProjectId)) {
            previousProjectIdRef.current = newProjectId;
            try {
              await cacheInvalidationService.connect(newProjectId);
            } catch (error: any) {
              if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
                console.error('❌ Not authorized for project, clearing selection');
                if (currentUserId) {
                  clearSelectedProject(currentUserId);
                }
                previousProjectIdRef.current = null;
              }
              console.error('❌ Failed to connect WebSocket:', error);
            }
          } else if (newProjectId) {
            console.warn('⚠️ Invalid projectId from storage event, clearing:', newProjectId);
            if (currentUserId) {
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
  }, [authState, validateProjectIdFromCache]);

  // Listen for same-tab project selection changes (via 'project-changed' custom event)
  useEffect(() => {
    if (authState !== 'authenticated') return;

    const handleProjectChange = async (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId: string | null }>;
      const newProjectId = customEvent.detail?.projectId;
      const oldProjectId = previousProjectIdRef.current;

      console.log('📢 Project changed event received', { oldProjectId, newProjectId });

      if (newProjectId !== oldProjectId) {
        if (oldProjectId !== null) {
          cacheInvalidationService.disconnect('Project changed (same-tab)');
        }

        const currentUserId = getUserId();
        if (newProjectId && validateProjectIdFromCache(newProjectId)) {
          previousProjectIdRef.current = newProjectId;
          validatedProjectIdRef.current = newProjectId;
          try {
            console.log('🔌 Connecting WebSocket for new project:', newProjectId);
            await cacheInvalidationService.connect(newProjectId);
          } catch (error: any) {
            if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
              console.error('❌ Not authorized for project, clearing selection');
              if (currentUserId) {
                clearSelectedProject(currentUserId);
              }
              previousProjectIdRef.current = null;
              validatedProjectIdRef.current = null;
            }
            console.error('❌ Failed to connect WebSocket:', error);
          }
        } else if (newProjectId) {
          console.warn('⚠️ Invalid projectId from project-changed event, clearing:', newProjectId);
          if (currentUserId) {
            clearSelectedProject(currentUserId);
          }
          previousProjectIdRef.current = null;
          validatedProjectIdRef.current = null;
        } else {
          console.log('🔌 Project cleared, disconnecting WebSocket');
          cacheInvalidationService.disconnect('No project selected');
          previousProjectIdRef.current = null;
          validatedProjectIdRef.current = null;
        }
      }
    };

    window.addEventListener('project-changed', handleProjectChange as EventListener);

    return () => {
      window.removeEventListener('project-changed', handleProjectChange as EventListener);
    };
  }, [authState, validateProjectIdFromCache]);

  // Phase 4.1: Login
  const login = useCallback(async (credentials: LoginModel | any): Promise<AuthToken> => {
    try {
      const { rememberMe, ...loginCredentials } = credentials;
      const result = await loginService(loginCredentials, rememberMe) as any;
      const userId = result.userId || result.user_id || getUserId();
      setAuthState('authenticated');
      setUserId(userId);
      return { Token: result.token || result.Token, userId };
    } catch (error) {
      setAuthState('unauthenticated');
      setUserId(null);
      throw error;
    }
  }, []);

  // Phase 4.2: Logout
  const logout = useCallback(() => {
    console.log('🚪 Logout initiated');
    
    setAuthState('unauthenticated');
    setUserId(null);
    
    queryClient.cancelQueries();
    cacheInvalidationService.disconnect('User logout');
    previousProjectIdRef.current = null;
    validatedProjectIdRef.current = null;
    isConnectingRef.current = false;
    
    const currentUserId = getUserId();
    if (currentUserId) {
      clearSelectedProject(currentUserId);
    }
    
    logoutService();
    queryClient.clear();
    localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
    
    console.log('✅ Logout completed');
  }, [queryClient]);

  const refreshToken = useCallback(async (): Promise<AuthToken> => {
    try {
      const result = await refreshTokenService();
      setAuthState('authenticated');
      setUserId(result.userId);
      return result;
    } catch (error) {
      setAuthState('unauthenticated');
      setUserId(null);
      throw error;
    }
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    userId,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login as loginService, logout as logoutService, refreshToken as refreshTokenService, getUserId, AuthToken } from '../services/authService.ts';
import { LoginModel } from '../models/user.ts';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
import { getSelectedProject, clearSelectedProject } from '../services/storageService';
import { isTokenExpired } from '../lib/apiClient.ts';

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
  const isConnectingRef = useRef<boolean>(false); // Track if we're currently connecting
  const validatedProjectIdRef = useRef<string | null>(null); // Track last validated projectId
  const selectedProjectIdRef = useRef<string | null>(null); // Track stable selectedProjectId across navigations
  const explicitLogoutRef = useRef<boolean>(false); // Track if logout was explicitly called
  const authInitializedRef = useRef<boolean>(false); // Track if auth has been initialized
  
  // Direct validation without triggering queries - reads from cache only
  const validateProjectIdFromCache = useCallback((projectId: string): boolean => {
    // Read from cache - don't trigger refetch
    const cached = queryClient.getQueryData(['projects', 'list']);
    const projects = Array.isArray(cached) ? cached : (cached?.projects || []);
    
    if (projects.length === 0) {
      // No projects cached - assume valid (don't clear on empty cache)
      // The backend will reject unauthorized WS connections anyway
      return true;
    }
    
    return projects.some((p: any) => p.id === projectId);
  }, [queryClient]);

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
  
  // Initialize state to false - will be set to true only after validation
  // This prevents queries from running before auth state is determined
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(() => getUserId());
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Check for existing auth state on mount
  // CRITICAL: This only runs ONCE on mount - auth state is stable after initialization
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const storedUserId = getUserId();
        const hasToken = !!localStorage.getItem('token');

        if (hasToken && storedUserId) {
          // Check if token is expired (basic JWT exp check)
          // If expired, attempt refresh - backend will tell us if refresh token is invalid
          if (isTokenExpired()) {
            console.log('⚠️ Access token expired, attempting refresh');
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
            // Token exists and is not expired - assume authenticated
            // Backend will tell us via 401 if token is actually invalid
            setIsAuthenticated(true);
            setUserId(storedUserId);
          }
        } else {
          // No token or userId - not authenticated
          setIsAuthenticated(false);
          setUserId(null);
        }
      } catch (error) {
        console.error('❌ Error checking auth state:', error);
        setIsAuthenticated(false);
        setUserId(null);
      } finally {
        setIsInitializing(false);
        authInitializedRef.current = true; // Mark as initialized
      }
    };

    checkAuthState();
    
    // Listen for auth state changes from API client (e.g., when refresh fails)
    const handleAuthStateChange = () => {
      // Only respond to explicit auth-state-changed events (from logout or token expiration)
      // NOT from transient state changes during navigation
      const storedUserId = getUserId();
      const hasToken = !!localStorage.getItem('token');
      
      if (!hasToken || !storedUserId) {
        console.log('🔓 Auth state changed: tokens cleared, setting authenticated=false');
        explicitLogoutRef.current = true; // Mark as explicit logout
        setIsAuthenticated(false);
        setUserId(null);
      }
    };
    
    window.addEventListener('auth-state-changed', handleAuthStateChange);
    
    // Handle page visibility changes (mobile background/locked screen)
    // When page becomes visible again, check and refresh token if needed
    // CRITICAL: Check for token existence, not isAuthenticated state
    // (isAuthenticated might be false if token expired while in background)
    const handleVisibilityChange = async () => {
      // Only check if page is visible
      if (document.visibilityState === 'visible') {
        const storedUserId = getUserId();
        const hasToken = !!localStorage.getItem('token');
        
        // Check for token existence (not isAuthenticated state)
        // This ensures we refresh even if token expired while in background
        if (hasToken && storedUserId) {
          // Check if token is expired or about to expire
          if (isTokenExpired()) {
            console.log('📱 Page visible: Token expired while in background, refreshing...');
            try {
              await refreshTokenService();
              setIsAuthenticated(true);
              setUserId(storedUserId);
              console.log('✅ Token refreshed after page visibility change');
            } catch (error) {
              // Refresh failed - check if it's a 401 (refresh token invalid)
              const is401 = error?.response?.status === 401 || (error as any)?.status === 401;
              if (is401) {
                console.log('⚠️ Refresh token invalid after visibility change, clearing auth state');
                setIsAuthenticated(false);
                setUserId(null);
                logoutService();
              } else {
                console.error('❌ Unexpected error during token refresh on visibility change:', error);
              }
            }
          } else {
            // Token is still valid, but check if it expires soon (within 5 minutes)
            // Proactively refresh to prevent expiration during next background period
            const expirationTimestamp = localStorage.getItem('tokenExpiration');
            if (expirationTimestamp) {
              const expirationTime = parseInt(expirationTimestamp, 10);
              const now = Date.now();
              const timeUntilExpiration = expirationTime - now;
              const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
              
              // If token expires within 5 minutes, refresh proactively
              if (timeUntilExpiration > 0 && timeUntilExpiration < fiveMinutes) {
                console.log('📱 Page visible: Token expires soon, refreshing proactively...');
                try {
                  await refreshTokenService();
                  console.log('✅ Token refreshed proactively after page visibility change');
                } catch (error) {
                  console.error('❌ Failed to proactively refresh token on visibility change:', error);
                  // Don't clear auth on proactive refresh failure - token is still valid
                }
              }
            }
          }
        }
      }
    };
    
    // Listen for visibility changes (handles mobile background/locked screen)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for focus events (additional mobile browser support)
    // Focus event fires when user switches back to the app/tab
    const handleFocus = async () => {
      await handleVisibilityChange();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Periodic token refresh check (only when page is visible to save battery)
    // Checks every 5 minutes if token is about to expire
    // This handles cases where token expires during active use
    const tokenRefreshInterval = setInterval(() => {
      // Only check if page is visible (don't waste battery when in background)
      if (document.visibilityState === 'visible') {
        const storedUserId = getUserId();
        const hasToken = !!localStorage.getItem('token');
        
        if (hasToken && storedUserId) {
          // Check if token is expired or expires within 5 minutes
          if (isTokenExpired()) {
            console.log('⏰ Periodic check: Token expired, refreshing...');
            refreshTokenService()
              .then(() => {
                setIsAuthenticated(true);
                setUserId(storedUserId);
                console.log('✅ Token refreshed via periodic check');
              })
              .catch((error) => {
                const is401 = error?.response?.status === 401 || (error as any)?.status === 401;
                if (is401) {
                  console.log('⚠️ Refresh token invalid during periodic check, clearing auth state');
                  setIsAuthenticated(false);
                  setUserId(null);
                  logoutService();
                }
              });
          } else {
            // Check if token expires within 5 minutes
            const expirationTimestamp = localStorage.getItem('tokenExpiration');
            if (expirationTimestamp) {
              const expirationTime = parseInt(expirationTimestamp, 10);
              const now = Date.now();
              const timeUntilExpiration = expirationTime - now;
              const fiveMinutes = 5 * 60 * 1000;
              
              if (timeUntilExpiration > 0 && timeUntilExpiration < fiveMinutes) {
                console.log('⏰ Periodic check: Token expires soon, refreshing proactively...');
                refreshTokenService()
                  .then(() => {
                    console.log('✅ Token refreshed proactively via periodic check');
                  })
                  .catch((error) => {
                    console.error('❌ Failed to proactively refresh token during periodic check:', error);
                  });
              }
            }
          }
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(tokenRefreshInterval);
    };
  }, []); // Empty deps - only runs once on mount, handlers check state dynamically

  // SINGLE OWNER: Connect cache invalidation WebSocket when authenticated with project selected
  // Only connects on: login (isAuthenticated change) or project change
  // Disconnects on: EXPLICIT logout or project cleared
  // CRITICAL: NEVER disconnect on transient isAuthenticated=false during navigation
  // NOTE: Reconnection on network errors is handled by cacheInvalidationService internally
  // STABILITY: Dependencies only include stable auth state, not route-dependent values
  useEffect(() => {
    // CRITICAL: Ignore transient auth false states during navigation
    // Only respond to actual logout (explicitLogoutRef.current === true)
    if (!authInitializedRef.current) {
      // Auth not initialized yet - wait
      return;
    }

    if (!isAuthenticated && explicitLogoutRef.current) {
      // Explicit logout - disconnect WebSocket
      console.log('🔓 Explicit logout detected, disconnecting WebSocket');
      cacheInvalidationService.disconnect('User logout');
      previousProjectIdRef.current = null;
      validatedProjectIdRef.current = null;
      isConnectingRef.current = false;
      selectedProjectIdRef.current = null;
      explicitLogoutRef.current = false; // Reset flag
      return;
    }

    if (!isAuthenticated && !explicitLogoutRef.current) {
      // Transient false during navigation or initialization - IGNORE
      console.log('⏭️ Ignoring transient auth false state (no explicit logout)');
      return;
    }

    if (isInitializing) {
      // Still initializing - wait
      return;
    }

    // Get selectedProjectId scoped to current user and stabilize with ref
    const currentUserId = getUserId();
    const selectedProjectId = getSelectedProject(currentUserId);
    
    // Update stable ref only if projectId actually changed
    if (selectedProjectIdRef.current !== selectedProjectId) {
      selectedProjectIdRef.current = selectedProjectId;
    }
    
    if (!selectedProjectId) {
      // Disconnect if no project selected
      cacheInvalidationService.disconnect('No project selected');
      previousProjectIdRef.current = null;
      validatedProjectIdRef.current = null;
      isConnectingRef.current = false;
      return;
    }

    // CRITICAL: Prevent clearing projectId while WebSocket is connecting
    // If we're in the middle of connecting, don't re-validate or clear
    if (isConnectingRef.current && validatedProjectIdRef.current === selectedProjectId) {
      console.log('⏳ WebSocket connection in progress, skipping re-validation for:', selectedProjectId);
      return;
    }

    // Validate using cache-only check (doesn't trigger refetch)
    const isValid = validateProjectIdFromCache(selectedProjectId);
    if (!isValid && !isConnectingRef.current) {
      // Projects are in cache and projectId not found → invalid
      // Read cache to get available projects for logging
      const cached = queryClient.getQueryData(['projects', 'list']);
      const projects = Array.isArray(cached) ? cached : (cached?.projects || []);
      
      console.warn('⚠️ Selected projectId not in cache, clearing selection:', {
        projectId: selectedProjectId,
        cachedProjectsCount: projects.length
      });
      clearSelectedProject(currentUserId);
      cacheInvalidationService.disconnect('Project not accessible');
      previousProjectIdRef.current = null;
      validatedProjectIdRef.current = null;
      return;
    }
    
    // Mark as validated
    if (isValid) {
      validatedProjectIdRef.current = selectedProjectId;
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
        isConnectingRef.current = true;
        try {
          await cacheInvalidationService.connect(selectedProjectId);
          console.log('✅ WebSocket connected for project:', selectedProjectId);
          isConnectingRef.current = false;
        } catch (error: any) {
          isConnectingRef.current = false;
          // Handle 403 Forbidden - clear invalid projectId
          if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
            console.error('❌ Not authorized for project, clearing selection');
            clearSelectedProject(currentUserId);
            previousProjectIdRef.current = null;
            validatedProjectIdRef.current = null;
          }
          console.error('❌ Failed to connect WebSocket:', error);
        }
      } else if (!cacheInvalidationService.isConnected()) {
        // Same project but not connected - connect (e.g., after page refresh)
        console.log('🔌 Connecting WebSocket for project:', selectedProjectId);
        isConnectingRef.current = true;
        try {
          await cacheInvalidationService.connect(selectedProjectId);
          console.log('✅ WebSocket connected for project:', selectedProjectId);
          isConnectingRef.current = false;
        } catch (error: any) {
          isConnectingRef.current = false;
          // Handle 403 Forbidden - clear invalid projectId
          if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
            console.error('❌ Not authorized for project, clearing selection');
            clearSelectedProject(currentUserId);
            previousProjectIdRef.current = null;
            validatedProjectIdRef.current = null;
          }
          console.error('❌ Failed to connect WebSocket:', error);
        }
      }
    };

    connectWebSocket();
  }, [isAuthenticated, isInitializing, validateProjectIdFromCache, queryClient]); // Stable dependencies only - no route-dependent values

  // Listen for project selection changes via storage events (cross-tab communication)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === 'selectedProjectId') {
        const newProjectId = e.newValue;
        const oldProjectId = previousProjectIdRef.current;
        
        if (newProjectId !== oldProjectId) {
          if (oldProjectId !== null) {
            cacheInvalidationService.disconnect('Project changed via storage event');
          }
          
          // Validate new projectId before connecting (cache-only check)
          const currentUserId = getUserId();
          if (newProjectId && validateProjectIdFromCache(newProjectId)) {
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
            // Invalid projectId - clear it
            console.warn('⚠️ Invalid projectId from storage event, clearing:', newProjectId);
            clearSelectedProject(currentUserId);
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
  }, [isAuthenticated, validateProjectIdFromCache]);

  // Listen for same-tab project selection changes (via 'project-changed' custom event)
  // This ensures WebSocket reconnects when a project is selected after OAuth login
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleProjectChange = async (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId: string | null }>;
      const newProjectId = customEvent.detail?.projectId;
      const oldProjectId = previousProjectIdRef.current;

      console.log('📢 Project changed event received', { oldProjectId, newProjectId });

      if (newProjectId !== oldProjectId) {
        if (oldProjectId !== null) {
          cacheInvalidationService.disconnect('Project changed (same-tab)');
        }

        // Validate new projectId before connecting (cache-only check)
        const currentUserId = getUserId();
        if (newProjectId && validateProjectIdFromCache(newProjectId)) {
          previousProjectIdRef.current = newProjectId;
          validatedProjectIdRef.current = newProjectId;
          try {
            console.log('🔌 Connecting WebSocket for new project:', newProjectId);
            await cacheInvalidationService.connect(newProjectId);
          } catch (error: any) {
            // Handle 403 Forbidden - clear invalid projectId
            if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
              console.error('❌ Not authorized for project, clearing selection');
              clearSelectedProject(currentUserId);
              previousProjectIdRef.current = null;
              validatedProjectIdRef.current = null;
            }
            console.error('❌ Failed to connect WebSocket:', error);
          }
        } else if (newProjectId) {
          // Invalid projectId - clear it
          console.warn('⚠️ Invalid projectId from project-changed event, clearing:', newProjectId);
          clearSelectedProject(currentUserId);
          previousProjectIdRef.current = null;
          validatedProjectIdRef.current = null;
        } else {
          // Project cleared - disconnect WebSocket
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
  }, [isAuthenticated, validateProjectIdFromCache]);

  // WebSocket maintains connection and handles cache invalidation
  // No need to invalidate on visibility change

  const login = useCallback(async (credentials: LoginModel | any): Promise<AuthToken> => {
    try {
      // Extract rememberMe if present, then pass credentials and rememberMe separately
      const { rememberMe, ...loginCredentials } = credentials;
      const result = await loginService(loginCredentials, rememberMe);
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
    // CRITICAL: Set explicit logout flag FIRST
    // This tells the WebSocket effect that this is a real logout, not a transient state
    explicitLogoutRef.current = true;
    
    // 1. CRITICAL: Clear auth state to immediately disable all queries
    // This prevents any new queries from starting
    setIsAuthenticated(false);
    setUserId(null);
    
    // 2. Cancel all in-flight queries to prevent them from completing
    queryClient.cancelQueries();
    
    // 3. Disconnect cache invalidation WebSocket with explicit reason
    // The effect will handle this via explicitLogoutRef
    // This ensures all timers are cleared and no reconnection attempts happen
    cacheInvalidationService.disconnect('User logout');
    previousProjectIdRef.current = null;
    
    // 4. Clear selected project for current user before logout
    const currentUserId = getUserId();
    if (currentUserId) {
      clearSelectedProject(currentUserId);
    }
    
    // 5. Clear auth tokens and call logout service
    logoutService();
    
    // 6. Clear all cached queries (after canceling in-flight ones)
    queryClient.clear();

    // CRITICAL: Also clear the persisted React Query cache from localStorage
    localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');

    // 7. Reset token expiration log flag
    if ((window as any).__tokenExpiredLogged) {
      delete (window as any).__tokenExpiredLogged;
    }
    
    // 8. Dispatch event to notify any listeners that auth state has changed
    window.dispatchEvent(new Event('auth-state-changed'));
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


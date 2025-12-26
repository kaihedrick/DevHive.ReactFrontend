import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login as loginService, logout as logoutService, refreshToken as refreshTokenService, getUserId, AuthToken } from '../services/authService.ts';
import { LoginModel } from '../models/user.ts';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
import { getSelectedProject, clearSelectedProject, clearAllSelectedProjects } from '../services/storageService.js';
import { refreshToken as refreshTokenApi, getAccessToken, setOAuthFlow, clearAccessToken, setAuthInitialized as setApiAuthInitialized } from '../lib/apiClient.ts';

// Import JWT expiration check from cache invalidation service
const isJWTExpired = (token: string, bufferSeconds: number = 30): boolean => {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('⚠️ Invalid JWT format');
      return true; // Consider invalid tokens as expired
    }

    // Decode payload (second part) - base64url decode
    const payload = parts[1];
    // Replace URL-safe base64 characters and add padding if needed
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    const decoded = JSON.parse(atob(padded));

    // Check exp claim (expiration time in seconds since epoch)
    if (decoded.exp) {
      const expTime = decoded.exp;
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      // Proactive check: token expires within bufferSeconds
      const expiresWithinBuffer = expTime < (now + bufferSeconds);

      if (expiresWithinBuffer) {
        const timeUntilExpiry = expTime - now;
        if (timeUntilExpiry > 0) {
          console.log(`⚠️ JWT expires within ${bufferSeconds}s (expires in ${timeUntilExpiry}s), refreshing proactively...`);
        } else {
          console.log(`⚠️ JWT expired: exp=${expTime}, now=${now}, diff=${now - expTime}s`);
        }
      }

      return expiresWithinBuffer;
    }

    // No exp claim - consider expired for safety
    console.warn('⚠️ JWT has no exp claim');
    return true;
  } catch (error) {
    console.error('❌ Failed to decode JWT:', error);
    return true; // Consider invalid tokens as expired
  }
};

type AuthState = 'unknown' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  isLoading: boolean;
  authInitialized: boolean;
  login: (credentials: LoginModel | any) => Promise<AuthToken>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<AuthToken>;
  setOAuthMode: (enabled: boolean) => void;
  isOAuthMode: () => boolean;
  completeOAuthLogin: (userId: string) => void;
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
  const authModeRef = useRef<'normal' | 'oauth'>('normal' as 'normal' | 'oauth'); // Task 2.2: Track OAuth mode

  // Auth state machine: unknown -> authenticated | unauthenticated
  const [authState, setAuthState] = useState<AuthState>('unknown');
  const [userId, setUserId] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false); // Task 1: Explicit initialization flag

  // Task 1.2: Auth invariant - isAuthenticated MUST derive from truth, never set manually
  // Auth truth: Boolean(userId && getAccessToken())
  // This is the single source of truth for authentication state
  const isAuthenticated = useMemo(() => {
    return Boolean(userId && getAccessToken());
  }, [userId]);
  
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
  // Task 3.1: Skip refresh if access token already exists (prevents double refresh after OAuth)
  // Task 1: Set authInitialized flag after initialization completes
  useEffect(() => {
    const initializeAuth = async () => {
      // Task 3.1: If token already exists (e.g., from OAuth), skip refresh
      const existingToken = getAccessToken();
      if (existingToken) {
        // Token exists - get userId from localStorage and mark as authenticated
        const existingUserId = getUserId();
        setUserId(existingUserId || null);
        setAuthState(existingUserId ? 'authenticated' : 'unauthenticated');
        setAuthInitialized(true); // Task 1: Mark as initialized
        return;
      }

      // No token exists - attempt refresh to restore session
      try {
        await refreshTokenApi();
        // Refresh succeeded - get userId from localStorage (set by refreshToken)
        // Token is set in memory by refreshTokenApi
        const refreshedUserId = getUserId();
        setUserId(refreshedUserId || null);
        setAuthState(refreshedUserId ? 'authenticated' : 'unauthenticated');
      } catch (error: any) {
        const is401 = error?.response?.status === 401;
        const hasAccessToken = !!getAccessToken();
        
        if (is401) {
          // CRITICAL: Only clear auth on refresh 401 if NO access token exists
          // If access token exists, user just logged in and refresh cookie may not be ready yet
          if (!hasAccessToken) {
            console.log('🔄 Refresh 401 - no access token, clearing auth');
            // Refresh failed and no access token - clear userId, isAuthenticated will be false (derived)
            setUserId(null);
            setAuthState('unauthenticated');
          } else {
            console.log('🔄 Refresh 401 ignored - access token exists (likely fresh login)');
            // Access token exists - get userId from localStorage and mark as authenticated
            // User just logged in, refresh cookie may not be ready yet
            const existingUserId = getUserId();
            setUserId(existingUserId || null);
            setAuthState(existingUserId ? 'authenticated' : 'unauthenticated');
          }
        } else {
          // Non-401 error - network/server error, don't clear auth state
          console.log('🔄 Refresh failed with non-401 error, preserving auth state');
          // Check if we have access token - if so, use it
          if (hasAccessToken) {
            const existingUserId = getUserId();
            setUserId(existingUserId || null);
            setAuthState(existingUserId ? 'authenticated' : 'unauthenticated');
          } else {
            // No access token and refresh failed - clear auth
            setUserId(null);
            setAuthState('unauthenticated');
          }
        }
      } finally {
        // Task 1: Always mark as initialized after attempt, regardless of success/failure
        setAuthInitialized(true);
        // Also update apiClient so response interceptor knows auth is initialized
        setApiAuthInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  // Listen for auth state changes (when refresh token expires)
  useEffect(() => {
    const handleAuthStateChange = () => {
      // Check if userId was cleared from localStorage (refresh token expired)
      const storedUserId = getUserId();
      
      // If localStorage userId is cleared but state still has userId, sync state
      if (!storedUserId && userId) {
        console.log('🚪 Auth state changed - refresh token expired, clearing auth state');
        setUserId(null);
        setAuthState('unauthenticated');
        clearAccessToken();
        setApiAuthInitialized(false);
        
        // Clear selected project
        if (userId) {
          clearSelectedProject(userId);
        }
        
        // Disconnect WebSocket
        cacheInvalidationService.disconnect('Auth expired');
        previousProjectIdRef.current = null;
        validatedProjectIdRef.current = null;
        isConnectingRef.current = false;
      }
    };

    window.addEventListener('auth-state-changed', handleAuthStateChange);
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
  }, [userId]); // Include userId in dependencies to check when it changes

  // Proactive Token Refresh Effect
  // Check every 5 minutes if token expires within 10 minutes, refresh proactively
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      // Only run proactive refresh if user is authenticated and initialized
      if (!userId || !authInitialized) {
        return;
      }

      const token = getAccessToken();
      if (!token) {
        console.log('ℹ️ No access token for proactive refresh');
        return;
      }

      // Check if token expires within 10 minutes (600 seconds)
      if (isJWTExpired(token, 600)) { // 10 minute buffer
        console.log('🔄 Proactive token refresh: Token expires within 10 minutes');
        try {
          await refreshTokenApi();
          console.log('✅ Proactive token refresh successful');
        } catch (error) {
          console.error('❌ Proactive token refresh failed:', error);
          // Don't clear auth here - let the 401 interceptor handle it
          // This prevents false logouts from temporary network issues
        }
      } else {
        console.log('ℹ️ Token still valid (>10 minutes remaining), skipping proactive refresh');
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(refreshInterval);
  }, [userId, authInitialized]);

  // WebSocket Connection Management Effect (simplified)
  // Task 2.2: Guard against post-logout re-auth - check userId, not authState
  useEffect(() => {
    // Only connect when userId exists and token exists (isAuthenticated will be true)
    if (!userId) {
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
          cacheInvalidationService.disconnect('Project changed');
        }
        previousProjectIdRef.current = selectedProjectId;
        isConnectingRef.current = true;
        try {
          await cacheInvalidationService.connect(selectedProjectId);
          isConnectingRef.current = false;
        } catch (error: any) {
          isConnectingRef.current = false;
          if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
            if (currentUserId) {
              clearSelectedProject(currentUserId);
            }
            previousProjectIdRef.current = null;
            validatedProjectIdRef.current = null;
          }
        }
      } else if (!cacheInvalidationService.isConnected()) {
        // Same project but not connected - connect
        isConnectingRef.current = true;
        try {
          await cacheInvalidationService.connect(selectedProjectId);
          isConnectingRef.current = false;
        } catch (error: any) {
          isConnectingRef.current = false;
          if (error?.message?.includes('not authorized') || error?.message?.includes('Forbidden')) {
            if (currentUserId) {
              clearSelectedProject(currentUserId);
            }
            previousProjectIdRef.current = null;
            validatedProjectIdRef.current = null;
          }
        }
      }
    };

    connectWebSocket();
  }, [userId, validateProjectIdFromCache, queryClient]);

  // Listen for project selection changes via storage events (cross-tab communication)
  useEffect(() => {
    if (!userId) return;

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
                if (currentUserId) {
                  clearSelectedProject(currentUserId);
                }
                previousProjectIdRef.current = null;
              }
            }
          } else if (newProjectId) {
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
  }, [userId, validateProjectIdFromCache]);

  // Listen for same-tab project selection changes (via 'project-changed' custom event)
  useEffect(() => {
    if (!userId) return;

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
  }, [userId, validateProjectIdFromCache]);

  // Phase 4.1: Login
  // Task 1.1: No manual auth assertions - only set userId, token is set by loginService
  const login = useCallback(async (credentials: LoginModel | any): Promise<AuthToken> => {
    try {
      const { rememberMe, ...loginCredentials } = credentials;
      const result = await loginService(loginCredentials, rememberMe) as any;
      const userId = result.userId || result.user_id || getUserId();
      // Only set userId - isAuthenticated derives from userId && token
      setUserId(userId);
      setAuthState('authenticated');
      return { Token: result.token || result.Token, userId };
    } catch (error) {
      setUserId(null);
      setAuthState('unauthenticated');
      throw error;
    }
  }, []);

  // Task 2.1: Enforce synchronous logout ordering
  // Order: 1. Call backend logout to clear refresh token cookie, 2. Clear token, 3. Set userId = null, 4. isAuthenticated = false (derived), 5. Clear project, 6. Clear ALL caches
  const logout = useCallback(async () => {
    console.log('🚪 Logout initiated');
    
    // Step 1: Call backend logout endpoint to clear refresh token cookie (HTTP-only cookie)
    try {
      await logoutService();
    } catch (error) {
      // Even if backend logout fails, continue with local cleanup
      console.warn('⚠️ Backend logout failed, continuing with local cleanup:', error);
    }
    
    // Step 2: Clear in-memory access token (synchronous)
    clearAccessToken();
    
    // Step 2.5: Reset auth initialization flag in apiClient
    setApiAuthInitialized(false);
    
    // Step 3: Set userId = null (synchronous) - this must happen BEFORE clearing localStorage
    setUserId(null);
    
    // Step 4: Set authState (isAuthenticated will be false because userId is null)
    setAuthState('unauthenticated');
    
    // Step 5: Clear selected project (get userId before it's fully cleared)
    const currentUserId = getUserId();
    if (currentUserId) {
      clearSelectedProject(currentUserId);
    }
    
    // Step 6: Clear ALL caches and disconnect
    queryClient.cancelQueries();
    cacheInvalidationService.disconnect('User logout');
    previousProjectIdRef.current = null;
    validatedProjectIdRef.current = null;
    isConnectingRef.current = false;
    
    // Clear all React Query cache (including projects, users, tasks, sprints, messages, etc.)
    queryClient.clear();
    
    // Clear all selected project keys (for all users - defensive cleanup)
    clearAllSelectedProjects();
    
    // Clear all localStorage items related to auth and cache
    localStorage.removeItem('userId');
    localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
    
    // Clear any other potential localStorage keys (defensive cleanup)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('react-query') ||
        key === 'token' // Legacy token key if it exists
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('✅ Logout completed - all state cleared');
  }, [queryClient]);

  // Task 2.2: OAuth mode guard functions
  const setOAuthMode = useCallback((enabled: boolean) => {
    authModeRef.current = enabled ? 'oauth' : 'normal';
    setOAuthFlow(enabled); // Also set flag in apiClient
  }, []);

  // Task 2.1: Complete OAuth login - sets userId and authState without calling refresh
  const completeOAuthLogin = useCallback((userId: string) => {
    // Token is already stored in memory by storeAuthData
    // Just set userId and authState - isAuthenticated will derive from userId && token
    setUserId(userId);
    setAuthState('authenticated');
  }, []);

  const isOAuthMode = useCallback(() => {
    return authModeRef.current === 'oauth';
  }, []);

  // Task 1.1: No manual auth assertions - only set userId, token is set by refreshTokenService
  // Task 3.2: Never clear auth on refresh 401 during OAuth
  const refreshToken = useCallback(async (): Promise<AuthToken> => {
    // Task 3.2: Skip refresh if OAuth mode is active
    if (isOAuthMode()) {
      // OAuth flow is in progress - don't refresh, just return current state
      const currentUserId = getUserId();
      const currentToken = getAccessToken();
      if (currentUserId && currentToken) {
        setUserId(currentUserId);
        setAuthState('authenticated');
        return { Token: currentToken, userId: currentUserId };
      }
      throw new Error('OAuth mode active but no token found');
    }

    try {
      const result = await refreshTokenService();
      // Only set userId - isAuthenticated derives from userId && token
      setUserId(result.userId);
      setAuthState('authenticated');
      return result;
    } catch (error: any) {
      const is401 = error?.response?.status === 401;
      if (is401) {
        // Task 3.2: Do not clear auth on refresh 401 during OAuth
        if (isOAuthMode()) {
          // OAuth flow must win - don't clear token or logout
          throw error;
        }
        console.log('🔄 Refresh 401');
      }
      setUserId(null);
      setAuthState('unauthenticated');
      throw error;
    }
  }, [isOAuthMode]);

  const value: AuthContextType = {
    isAuthenticated,
    userId,
    isLoading,
    authInitialized,
    login,
    logout,
    refreshToken,
    setOAuthMode,
    isOAuthMode,
    completeOAuthLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

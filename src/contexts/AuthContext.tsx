import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login as loginService, logout as logoutService, refreshToken as refreshTokenService, getUserId, AuthToken } from '../services/authService.ts';
import { LoginModel } from '../models/user.ts';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
import { getSelectedProject, clearSelectedProject } from '../services/storageService';
import { isTokenExpired, setIsRefreshing, setAuthInitializationPromise, getAccessToken, getIsRefreshing } from '../lib/apiClient.ts';

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
  const logoutRef = useRef<(() => void) | null>(null); // Ref to logout function for use in event handlers
  
  // Direct validation without triggering queries - reads from cache only
  const validateProjectIdFromCache = useCallback((projectId: string): boolean => {
    // Read from cache - don't trigger refetch
    const cached = queryClient.getQueryData(['projects', 'list']) as any;
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

        console.log('🔐 checkAuthState:', {
          hasToken,
          storedUserId: storedUserId ? '(present)' : '(null)',
          tokenExpiration: localStorage.getItem('tokenExpiration')
        });

        // CRITICAL: Always attempt refresh on initialization, regardless of storedUserId
        // We cannot check if the refresh token cookie exists from JavaScript (it's HttpOnly).
        // The refresh token cookie may persist even if localStorage was cleared.
        // 
        // If refresh succeeds: We get a new access token and userId (stored in localStorage by refreshToken).
        // If refresh fails with 401: The refresh token cookie is invalid/expired - user is logged out.
        // If refresh fails with non-401: Network error - we'll stay logged out for now, but user can retry.
        //
        // The refresh endpoint only checks the refresh token cookie, not the access token or localStorage.
        // Refresh tokens last 7 days (session) or 30 days (persistent/rememberMe) based on user's choice.
        //
        // This ensures users stay logged in even if localStorage was cleared but refresh token cookie persists.
        console.log('🔄 Attempting token refresh to restore session (checking refresh token cookie)');

        // CRITICAL: Set isRefreshing flag and promise BEFORE refresh
        // This coordinates with the response interceptor to prevent concurrent refreshes
        // and allows 401 responses to wait for initialization to complete
        setIsRefreshing(true);

        // Create and store the initialization promise
        const refreshPromise = (async (): Promise<string | null> => {
          try {
            const result = await refreshTokenService();
            return result?.Token || getAccessToken();
          } catch (error) {
            throw error;
          } finally {
            // Always clean up
            setIsRefreshing(false);
            setAuthInitializationPromise(null);
          }
        })();

        setAuthInitializationPromise(refreshPromise);

        try {
          await refreshPromise;
          // Refresh succeeded - get userId from localStorage (it was stored by refreshToken)
          const refreshedUserId = getUserId();
          if (refreshedUserId) {
            setIsAuthenticated(true);
            setUserId(refreshedUserId);
            console.log('✅ Token refresh successful during initialization, session restored');
            // Dispatch event so useRoutePermission can re-read project ID
            window.dispatchEvent(new Event('auth-state-changed'));
          } else {
            // This should not happen - refreshToken stores userId, but handle gracefully
            console.warn('⚠️ Refresh succeeded but no userId found, treating as logout');
            setIsAuthenticated(false);
            setUserId(null);
          }
        } catch (error) {
          // Refresh failed - check if it's a 401 (refresh token invalid/expired)
          const is401 = error?.response?.status === 401 || (error as any)?.status === 401;
          if (is401) {
            console.log('⚠️ Refresh token invalid/expired (401), no valid session cookie - user is logged out');
            // Use proper logout flow instead of direct logoutService() call
            // This ensures proper cleanup order and prevents remounting
            if (logoutRef.current) {
              logoutRef.current();
            } else {
              // Fallback if logout not yet available (shouldn't happen, but safety check)
              console.warn('⚠️ Logout function not available, using direct cleanup');
              explicitLogoutRef.current = true;
              setIsAuthenticated(false);
              setUserId(null);
              logoutService();
            }
          } else {
            // Network errors or other non-401 errors
            // If we had storedUserId, keep it (might be a transient network issue)
            // If we didn't, stay logged out (no session to restore)
            console.error('❌ Unexpected error during token refresh:', error);
            if (storedUserId) {
              console.log('⚠️ Non-401 error during refresh but had storedUserId, keeping auth state (token may still be valid)');
              setIsAuthenticated(true);
              setUserId(storedUserId);
              // Dispatch event so useRoutePermission can re-read project ID
              window.dispatchEvent(new Event('auth-state-changed'));
            } else {
              console.log('⚠️ Non-401 error during refresh and no storedUserId, staying logged out');
              setIsAuthenticated(false);
              setUserId(null);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error checking auth state:', error);
        setIsAuthenticated(false);
        setUserId(null);
      } finally {
        setIsInitializing(false);
        authInitializedRef.current = true; // Mark as initialized
        // Ensure cleanup even if early return or error
        setIsRefreshing(false);
        setAuthInitializationPromise(null);
      }
    };

    checkAuthState();
    
    /**
     * Auth State Change Event Handler
     * 
     * Listens for 'auth-state-changed' events dispatched by:
     * 1. apiClient.ts - When token refresh fails (tokens cleared)
     * 2. logout() function - After clearing tokens and cache
     * 3. GoogleOAuthCallback - After storing new tokens from OAuth login
     * 
     * Purpose: Re-validate auth state when tokens are added or removed externally.
     * This ensures AuthContext stays in sync with actual token state in localStorage.
     * 
     * Flow:
     * - If tokens cleared: Set explicitLogoutRef=true FIRST (before state changes), clear auth state (triggers WebSocket disconnect)
     * - If tokens present: Re-validate expiration, refresh if needed, update auth state
     * 
     * CRITICAL: Set explicitLogoutRef BEFORE clearing state to prevent race conditions
     * This ensures WebSocket effect sees the flag before checking isAuthenticated
     * 
     * Related Documentation:
     * - .agent/System/authentication_architecture.md - Auth state change flow (section 6)
     * - .agent/System/authentication_architecture.md - Logout flow (section 3)
     * - .agent/System/authentication_architecture.md - Google OAuth flow (section 1.5)
     */
    const handleAuthStateChange = async () => {
      // Re-validate auth state when auth-state-changed event is dispatched
      // This handles both logout (tokens cleared) and OAuth login (tokens newly stored)
      const storedUserId = getUserId();
      const hasToken = !!localStorage.getItem('token');
      
      if (!hasToken || !storedUserId) {
        // Tokens cleared - logout scenario
        // This can happen when:
        // 1. Token refresh failed (apiClient.ts dispatches event after clearing tokens)
        // 2. User explicitly logged out (logout() function dispatches event)
        // 3. Session expired on backend (refresh token invalid)
        console.log('🔓 Auth state changed: tokens cleared, triggering logout flow');
        
        // CRITICAL: Set explicitLogoutRef FIRST before any state changes
        // This prevents race condition where WebSocket effect checks before flag is set
        explicitLogoutRef.current = true;
        
        // Now clear auth state (triggers WebSocket disconnect via effect)
        setIsAuthenticated(false);
        setUserId(null);
        
        // Note: Don't call logoutService() here - tokens are already cleared by apiClient
        // The logout() function would be called if this was user-initiated logout
        // But for token refresh failures, apiClient already cleared tokens
      } else {
        // Tokens present - could be OAuth login or token refresh
        // Re-validate auth state to update isAuthenticated
        console.log('🔄 Auth state changed: tokens present, re-validating auth state');
        try {
          if (isTokenExpired()) {
            console.log('⚠️ Token expired on auth state change, attempting refresh');
            try {
              await refreshTokenService();
              setIsAuthenticated(true);
              setUserId(storedUserId);
              console.log('✅ Auth state updated after token refresh');
            } catch (error) {
              const is401 = error?.response?.status === 401 || (error as any)?.status === 401;
              if (is401) {
                console.log('⚠️ Refresh token invalid on auth state change, triggering logout');
                // Use proper logout flow instead of direct logoutService() call
                if (logoutRef.current) {
                  logoutRef.current();
                } else {
                  // Fallback if logout not yet available
                  console.warn('⚠️ Logout function not available, using direct cleanup');
                  explicitLogoutRef.current = true;
                  setIsAuthenticated(false);
                  setUserId(null);
                  logoutService();
                }
              } else {
                console.error('❌ Unexpected error during token refresh on auth state change:', error);
                // Network errors or other non-401 errors should NOT cause logout
                // Keep authenticated state - token might still be valid
                console.log('⚠️ Non-401 error during refresh, keeping auth state (token may still be valid)');
                setIsAuthenticated(true);
                setUserId(storedUserId);
              }
            }
          } else {
            // Token exists and is not expired - set authenticated
            setIsAuthenticated(true);
            setUserId(storedUserId);
            console.log('✅ Auth state updated: user authenticated');
          }
        } catch (error) {
          console.error('❌ Error re-validating auth state:', error);
          // On error, check if token exists - if yes, assume authenticated
          // Backend will tell us via 401 if token is actually invalid
          setIsAuthenticated(true);
          setUserId(storedUserId);
        }
      }
    };
    
    window.addEventListener('auth-state-changed', handleAuthStateChange);
    
    // Handle page visibility changes (mobile background/locked screen)
    // When page becomes visible again, check and refresh token if needed
    // CRITICAL: Check for token existence, not isAuthenticated state
    // (isAuthenticated might be false if token expired while in background)
    // Debounce rapid visibility changes to prevent multiple concurrent refresh attempts
    const VISIBILITY_REFRESH_DEBOUNCE = 2000; // Wait 2 seconds between visibility-triggered refreshes
    let visibilityRefreshTimeout: NodeJS.Timeout | null = null;
    let lastVisibilityRefresh = 0;

    const handleVisibilityChange = async () => {
      // Only check if page is visible
      if (document.visibilityState === 'visible') {
        // Clear any pending timeout
        if (visibilityRefreshTimeout) {
          clearTimeout(visibilityRefreshTimeout);
          visibilityRefreshTimeout = null;
        }

        const storedUserId = getUserId();

        // CRITICAL: Attempt refresh if we have userId, even if access token is missing/expired
        // The refresh endpoint only checks the refresh token cookie (HTTP-only, stored by backend).
        // The refresh token cookie may still be valid even if the access token is missing/expired.
        if (storedUserId) {
          // Debounce rapid visibility changes (common when switching apps or locking/unlocking screen)
          const now = Date.now();
          const timeSinceLastRefresh = now - lastVisibilityRefresh;
          
          // If refresh happened recently, debounce it
          if (timeSinceLastRefresh < VISIBILITY_REFRESH_DEBOUNCE) {
            console.log(`📱 Visibility change debounced (${timeSinceLastRefresh}ms since last refresh)`);
            visibilityRefreshTimeout = setTimeout(() => {
              handleVisibilityChange();
            }, VISIBILITY_REFRESH_DEBOUNCE - timeSinceLastRefresh);
            return;
          }

          // Check if refresh is already in progress (prevents concurrent refreshes)
          if (getIsRefreshing()) {
            console.log('📱 Refresh already in progress, skipping visibility-triggered refresh');
            return;
          }

          // CRITICAL: Always attempt refresh when page becomes visible if we have credentials
          // The refresh endpoint only checks the refresh token cookie, not the access token.
          // Even if the access token appears expired, the refresh token cookie might still be
          // valid (refresh tokens last 7 days for session or 30 days for persistent/rememberMe).
          // This ensures users stay logged in even after
          // the app has been closed/backgrounded for a long time.
          const tokenExpired = isTokenExpired();
          if (tokenExpired) {
            console.log('📱 Page visible: Token expired while in background, refreshing...');
          } else {
            console.log('📱 Page visible: Refreshing token to ensure fresh credentials...');
          }

          // Update last refresh time
          lastVisibilityRefresh = Date.now();

          // CRITICAL: Set isRefreshing flag and promise for visibility refresh
          // This coordinates with the response interceptor to prevent concurrent refreshes
          setIsRefreshing(true);

          const refreshPromise = (async (): Promise<string | null> => {
            try {
              const result = await refreshTokenService();
              return result?.Token || getAccessToken();
            } catch (error) {
              throw error;
            } finally {
              setIsRefreshing(false);
              setAuthInitializationPromise(null);
            }
          })();

          setAuthInitializationPromise(refreshPromise);

          try {
            await refreshPromise;
            setIsAuthenticated(true);
            setUserId(storedUserId);
            console.log('✅ Token refreshed after page visibility change');
          } catch (error) {
            // Refresh failed - check if it's a 401 (refresh token invalid)
            const is401 = error?.response?.status === 401 || (error as any)?.status === 401;
            if (is401) {
              console.log('⚠️ Refresh token invalid after visibility change, triggering logout');
              // Use proper logout flow instead of direct logoutService() call
              if (logoutRef.current) {
                logoutRef.current();
              } else {
                // Fallback if logout not yet available
                console.warn('⚠️ Logout function not available, using direct cleanup');
                explicitLogoutRef.current = true;
                setIsAuthenticated(false);
                setUserId(null);
                logoutService();
              }
            } else {
              console.error('❌ Unexpected error during token refresh on visibility change:', error);
              // Network errors or other non-401 errors should NOT cause logout
              // Token might still be valid, just couldn't refresh due to network issue
              // CRITICAL: Still set authenticated state to true - token is likely still valid
              console.log('⚠️ Non-401 error during refresh, keeping auth state (token may still be valid)');
              setIsAuthenticated(true);
              setUserId(storedUserId);
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
        
        // CRITICAL: Attempt refresh if we have userId, even if access token is missing/expired
        // The refresh endpoint only checks the refresh token cookie (HTTP-only, stored by backend).
        if (storedUserId) {
          // CRITICAL: Always attempt refresh during periodic check if token is expired
          // For non-expired tokens, refresh proactively if they expire within 10 minutes
          // The refresh endpoint only checks the refresh token cookie, so we should refresh
          // whenever we detect the access token needs refreshing
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
                  console.log('⚠️ Refresh token invalid during periodic check, triggering logout');
                  // Use proper logout flow instead of direct logoutService() call
                  if (logoutRef.current) {
                    logoutRef.current();
                  } else {
                    // Fallback if logout not yet available
                    console.warn('⚠️ Logout function not available, using direct cleanup');
                    explicitLogoutRef.current = true;
                    setIsAuthenticated(false);
                    setUserId(null);
                    logoutService();
                  }
                } else {
                  // Non-401 errors should NOT cause logout
                  console.log('⚠️ Non-401 error during periodic refresh, keeping auth state (token may still be valid)');
                }
              });
          } else {
            // Check if token expires within 10 minutes
            // Proactively refresh to prevent expiration during active use
            const expirationTimestamp = localStorage.getItem('tokenExpiration');
            if (expirationTimestamp) {
              const expirationTime = parseInt(expirationTimestamp, 10);
              const now = Date.now();
              const timeUntilExpiration = expirationTime - now;
              const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
              
              if (timeUntilExpiration > 0 && timeUntilExpiration < tenMinutes) {
                console.log('⏰ Periodic check: Token expires soon, refreshing proactively...');
                refreshTokenService()
                  .then(() => {
                    console.log('✅ Token refreshed proactively via periodic check');
                  })
                  .catch((error) => {
                    console.error('❌ Failed to proactively refresh token during periodic check:', error);
                    // Don't clear auth on proactive refresh failure - token is still valid
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
      // Cleanup: Clear any pending visibility refresh timeout
      if (visibilityRefreshTimeout) {
        clearTimeout(visibilityRefreshTimeout);
        visibilityRefreshTimeout = null;
      }
    };
  }, []); // Empty deps - only runs once on mount, handlers check state dynamically

  /**
   * WebSocket Connection Management Effect
   * 
   * SINGLE OWNER: Connects cache invalidation WebSocket when authenticated with project selected.
   * 
   * Connection Triggers:
   * - User login (isAuthenticated changes from false to true)
   * - Project selection change (selectedProjectId changes)
   * - Page refresh with valid auth state
   * 
   * Disconnection Triggers:
   * - EXPLICIT logout (explicitLogoutRef.current === true)
   * - Project cleared (selectedProjectId becomes null)
   * - Invalid project access (403 Forbidden)
   * 
   * CRITICAL: Transient Auth State Protection
   * 
   * This effect implements protection against transient `isAuthenticated=false` states that can
   * occur during:
   * 1. Initial auth state check (before tokens are validated)
   * 2. Token refresh operations (brief moment during refresh)
   * 3. Navigation between routes (React state updates)
   * 4. Race conditions between token expiration and refresh
   * 
   * The `explicitLogoutRef` flag distinguishes between:
   * - EXPLICIT logout: User clicked logout OR token refresh failed (tokens cleared)
   * - TRANSIENT false: Temporary state during initialization or refresh
   * 
   * When `isAuthenticated=false` but `explicitLogoutRef.current=false`:
   * - This is a transient state - DO NOT disconnect WebSocket
   * - WebSocket connection remains active (prevents unnecessary reconnections)
   * - Auth state will stabilize once initialization/refresh completes
   * 
   * When `isAuthenticated=false` and `explicitLogoutRef.current=true`:
   * - This is an explicit logout - DISCONNECT WebSocket immediately
   * - Clear all refs and connection state
   * - Prevent any reconnection attempts
   * 
   * Logout Flow (see logout() function):
   * 1. Set explicitLogoutRef.current = true (marks as explicit logout)
   * 2. Set isAuthenticated = false (disables queries)
   * 3. Cancel in-flight queries
   * 4. Disconnect WebSocket (via this effect detecting explicitLogoutRef)
   * 5. Clear tokens and cache
   * 6. Dispatch 'auth-state-changed' event
   * 
   * Token Refresh Failure Flow (apiClient.ts):
   * 1. Refresh token API call fails (401 Unauthorized)
   * 2. clearAccessToken() clears tokens from memory + localStorage
   * 3. Dispatch 'auth-state-changed' event
   * 4. handleAuthStateChange() detects tokens cleared
   * 5. Sets explicitLogoutRef.current = true
   * 6. Sets isAuthenticated = false
   * 7. This effect detects explicitLogoutRef and disconnects WebSocket
   * 
   * NOTE: Reconnection on network errors is handled by cacheInvalidationService internally.
   * STABILITY: Dependencies only include stable auth state, not route-dependent values.
   * 
   * Related Documentation:
   * - .agent/System/authentication_architecture.md - Complete auth flows and token management
   * - .agent/System/realtime_messaging.md - WebSocket implementation and cache invalidation
   * - .agent/System/caching_strategy.md - React Query cache management
   */
  useEffect(() => {
    // CRITICAL: Wait for auth initialization to complete before making connection decisions
    // Prevents disconnecting during initial state check when tokens might be temporarily unavailable
    if (!authInitializedRef.current) {
      // Auth not initialized yet - wait for checkAuthState() to complete
      return;
    }

    // EXPLICIT LOGOUT: User clicked logout OR token refresh failed (tokens cleared)
    // This is a real logout - disconnect WebSocket and clear all state
    if (!isAuthenticated && explicitLogoutRef.current) {
      console.log('🔓 Explicit logout detected, disconnecting WebSocket');
      cacheInvalidationService.disconnect('User logout');
      previousProjectIdRef.current = null;
      validatedProjectIdRef.current = null;
      isConnectingRef.current = false;
      selectedProjectIdRef.current = null;
      explicitLogoutRef.current = false; // Reset flag for next session
      return;
    }

    // TRANSIENT FALSE STATE: Temporary isAuthenticated=false during initialization or refresh
    // This happens when:
    // - Auth state is being checked on mount (before tokens are validated)
    // - Token refresh is in progress (brief moment during refresh)
    // - Race condition between token expiration check and refresh
    // 
    // DO NOT disconnect WebSocket - this would cause unnecessary reconnections
    // The auth state will stabilize once initialization/refresh completes
    if (!isAuthenticated && !explicitLogoutRef.current) {
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
      const cached = queryClient.getQueryData(['projects', 'list']) as any;
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
      const result = await loginService(loginCredentials, rememberMe) as any;
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

  /**
   * Logout Function
   * 
   * Performs complete logout sequence with proper cleanup order.
   * 
   * CRITICAL EXECUTION ORDER:
   * 1. Set explicitLogoutRef flag FIRST - tells WebSocket effect this is real logout
   * 2. Clear auth state - immediately disables all queries
   * 3. Cancel in-flight queries - prevents stale data from completing
   * 4. Disconnect WebSocket - stops real-time updates
   * 5. Clear selected project - removes user-scoped project selection
   * 6. Clear tokens - removes auth credentials from memory + localStorage
   * 7. Clear query cache - removes all cached data
   * 8. Clear persisted cache - removes offline cache from localStorage
   * 9. Dispatch event - notifies other components/tabs of logout
   * 
   * The explicitLogoutRef flag is critical because:
   * - WebSocket effect checks this flag to distinguish explicit logout from transient states
   * - Without this flag, WebSocket might not disconnect during logout
   * - Prevents race conditions where isAuthenticated=false occurs during navigation
   * 
   * NOTE: This function does NOT redirect - let ProtectedRoute handle navigation
   * Redirecting causes remounting which loses console logs and breaks debugging
   * 
   * Related Documentation:
   * - .agent/System/authentication_architecture.md - Logout flow (section 3)
   * - .agent/System/authentication_architecture.md - Critical logout order table
   * - .agent/System/realtime_messaging.md - WebSocket disconnection handling
   * - .agent/System/caching_strategy.md - Cache clearing on logout
   */
  const logout = useCallback(() => {
    console.log('🚪 Logout initiated - starting cleanup sequence');
    
    // CRITICAL: Set explicit logout flag FIRST
    // This tells the WebSocket effect that this is a real logout, not a transient state
    // The WebSocket effect checks this flag to determine if it should disconnect
    explicitLogoutRef.current = true;
    
    // 1. CRITICAL: Clear auth state to immediately disable all queries
    // This prevents any new queries from starting
    setIsAuthenticated(false);
    setUserId(null);
    
    // 2. Cancel all in-flight queries to prevent them from completing
    // This ensures stale data doesn't populate the cache after logout
    queryClient.cancelQueries();
    
    // 3. Disconnect cache invalidation WebSocket with explicit reason
    // The WebSocket effect will also handle this via explicitLogoutRef check
    // This ensures all timers are cleared and no reconnection attempts happen
    cacheInvalidationService.disconnect('User logout');
    previousProjectIdRef.current = null;
    
    // 4. Clear selected project for current user before logout
    // This ensures project selection is cleared for the correct user
    const currentUserId = getUserId();
    if (currentUserId) {
      clearSelectedProject(currentUserId);
    }
    
    // 5. Clear auth tokens and call logout service
    // This removes tokens from memory (apiClient) and localStorage
    logoutService();
    
    // 6. Clear all cached queries (after canceling in-flight ones)
    // This removes all React Query cache data
    queryClient.clear();

    // CRITICAL: Also clear the persisted React Query cache from localStorage
    // This ensures offline cache doesn't persist across logout/login cycles
    localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');

    // 7. Reset token expiration log flag (prevents duplicate logs)
    if ((window as any).__tokenExpiredLogged) {
      delete (window as any).__tokenExpiredLogged;
    }
    
    // 8. Dispatch event to notify any listeners that auth state has changed
    // This triggers handleAuthStateChange() which will see tokens are cleared
    // Other tabs/components listening to this event will also update their state
    window.dispatchEvent(new Event('auth-state-changed'));
    
    console.log('✅ Logout cleanup sequence completed');
    // NOTE: Do NOT redirect here - let ProtectedRoute handle navigation
    // Redirecting causes remounting which loses console logs
  }, [queryClient]);
  
  // Store logout function in ref so it can be called from event handlers
  // This allows proper logout flow from anywhere without circular dependencies
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

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


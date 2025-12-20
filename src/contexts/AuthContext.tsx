import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login as loginService, logout as logoutService, refreshToken as refreshTokenService, getUserId, AuthToken } from '../services/authService.ts';
import { LoginModel } from '../models/user.ts';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
import { getSelectedProject } from '../services/storageService';
import { getAccessToken, isTokenExpiredBeyondWindow, isTokenExpired } from '../lib/apiClient.ts';

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

    const selectedProjectId = getSelectedProject();
    if (!selectedProjectId) {
      // Disconnect if no project selected
      cacheInvalidationService.disconnect('No project selected');
      previousProjectIdRef.current = null;
      return;
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
        await cacheInvalidationService.connect(selectedProjectId);
      } else if (!cacheInvalidationService.isConnected()) {
        // Same project but not connected - connect (e.g., after page refresh)
        await cacheInvalidationService.connect(selectedProjectId);
      }
    };

    connectWebSocket().catch((error) => {
      console.error('❌ Failed to connect WebSocket:', error);
    });
  }, [isAuthenticated, isInitializing]);

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
          previousProjectIdRef.current = newProjectId;
          if (newProjectId) {
            await cacheInvalidationService.connect(newProjectId);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated]);

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


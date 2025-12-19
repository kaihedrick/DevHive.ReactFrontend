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

  // Connect cache invalidation WebSocket when authenticated with project selected
  useEffect(() => {
    if (!isAuthenticated || isInitializing) {
      // Disconnect if not authenticated
      cacheInvalidationService.disconnect();
      previousProjectIdRef.current = null;
      return;
    }

    const selectedProjectId = getSelectedProject();
    const accessToken = getAccessToken() || localStorage.getItem('token');

    if (!selectedProjectId || !accessToken) {
      // No project selected or no token - disconnect
      cacheInvalidationService.disconnect();
      previousProjectIdRef.current = null;
      return;
    }

    // If project changed, disconnect old connection and connect new one
    if (previousProjectIdRef.current !== selectedProjectId) {
      if (previousProjectIdRef.current !== null) {
        console.log('🔄 Project changed, reconnecting cache invalidation WebSocket');
        cacheInvalidationService.disconnect();
      }
      previousProjectIdRef.current = selectedProjectId;
      cacheInvalidationService.connect(selectedProjectId, accessToken);
    } else if (!cacheInvalidationService.isConnected()) {
      // Same project but not connected - connect
      cacheInvalidationService.connect(selectedProjectId, accessToken);
    }

    // Cleanup on unmount
    return () => {
      // Don't disconnect on unmount - let it handle reconnection
      // Only disconnect if auth state changes
    };
  }, [isAuthenticated, isInitializing]);

  // Listen for project selection changes
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedProjectId') {
        const newProjectId = e.newValue;
        const oldProjectId = previousProjectIdRef.current;
        
        if (newProjectId !== oldProjectId) {
          const accessToken = getAccessToken() || localStorage.getItem('token');
          if (accessToken) {
            if (oldProjectId !== null) {
              cacheInvalidationService.disconnect();
            }
            previousProjectIdRef.current = newProjectId;
            if (newProjectId) {
              cacheInvalidationService.connect(newProjectId, accessToken);
            }
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for project changes (in case storage event doesn't fire)
    const checkProjectInterval = setInterval(() => {
      const currentProjectId = getSelectedProject();
      if (currentProjectId !== previousProjectIdRef.current) {
        const accessToken = getAccessToken() || localStorage.getItem('token');
        if (accessToken) {
          if (previousProjectIdRef.current !== null) {
            cacheInvalidationService.disconnect();
          }
          previousProjectIdRef.current = currentProjectId;
          if (currentProjectId) {
            cacheInvalidationService.connect(currentProjectId, accessToken);
          }
        }
      }
    }, 1000); // Check every second

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkProjectInterval);
    };
  }, [isAuthenticated]);

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
    // Disconnect cache invalidation WebSocket
    cacheInvalidationService.disconnect();
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


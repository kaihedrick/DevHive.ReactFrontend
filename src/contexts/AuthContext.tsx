import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login as loginService, logout as logoutService, refreshToken as refreshTokenService, getUserId, AuthToken } from '../services/authService.ts';
import { LoginModel } from '../models/user.ts';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Check for existing auth state on mount
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const storedUserId = getUserId();
        const hasToken = !!localStorage.getItem('token');

        if (hasToken && storedUserId) {
          // Try to refresh token silently
          try {
            const refreshed = await refreshTokenService();
            setIsAuthenticated(true);
            setUserId(refreshed.userId);
          } catch (error) {
            // Refresh failed, clear auth state
            console.log('⚠️ Token refresh failed on mount, clearing auth state');
            setIsAuthenticated(false);
            setUserId(null);
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

  const login = useCallback(async (credentials: LoginModel | any): Promise<AuthToken> => {
    try {
      const result = await loginService(credentials);
      setIsAuthenticated(true);
      setUserId(result.userId);
      return result;
    } catch (error) {
      setIsAuthenticated(false);
      setUserId(null);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
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


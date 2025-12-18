import { useState, useEffect } from 'react';
import { getAuthToken } from '../services/authService';
import { UseAuthReturn } from '../types/hooks';

/**
 * useAuth
 *
 * Custom React hook to manage authentication state.
 * Checks for presence of auth token in localStorage and updates state accordingly.
 * Subscribes to storage events to reflect changes across tabs/windows.
 *
 * @returns {UseAuthReturn} Authentication state and utilities
 */
const useAuth = (): UseAuthReturn => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getAuthToken());
  
  useEffect(() => {
    const checkAuthStatus = (): void => {
      const token = getAuthToken();
      setIsAuthenticated(!!token);
    };
    
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === 'token') {
        checkAuthStatus();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  return { isAuthenticated };
};

export default useAuth;

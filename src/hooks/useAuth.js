import { useState, useEffect } from 'react';
import { getAuthToken } from '../services/authService.ts';

/**
 * useAuth
 *
 * Custom React hook to manage authentication state.
 * Checks for presence of auth token in localStorage and updates state accordingly.
 * Subscribes to storage events to reflect changes across tabs/windows.
 *
 * @returns {Object} 
 *   isAuthenticated - Boolean indicating if the user is authenticated.
 */
function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());
  
  useEffect(() => {
    const checkAuthStatus = () => {
      const token = getAuthToken();
      setIsAuthenticated(!!token);
    };
    
    const handleStorageChange = (e) => {
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
}

// Only use default export for simplicity
export default useAuth;
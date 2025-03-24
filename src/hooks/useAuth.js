import { useState, useEffect } from 'react';
import { getAuthToken } from '../services/authService.ts';

/**
 * Custom hook to handle authentication state
 * @returns {Object} Authentication state
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
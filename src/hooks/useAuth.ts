import { useAuthContext } from '../contexts/AuthContext';

/**
 * useAuth
 *
 * Custom React hook to manage authentication state.
 * Consumes AuthContext which handles refresh token flow and persistent sessions.
 *
 * @returns {Object} Authentication state and utilities
 */
const useAuth = () => {
  const { isAuthenticated, isLoading } = useAuthContext();
  
  return { 
    isAuthenticated,
    isLoading 
  };
};

export default useAuth;

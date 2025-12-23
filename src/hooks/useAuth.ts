import { useAuthContext } from '../contexts/AuthContext.tsx';

/**
 * useAuth
 *
 * Custom React hook to manage authentication state.
 * Consumes AuthContext which handles refresh token flow and persistent sessions.
 *
 * @returns {Object} Authentication state and utilities
 */
const useAuth = () => {
  const { isAuthenticated, isLoading, userId, authInitialized } = useAuthContext();
  
  return { 
    isAuthenticated,
    isLoading,
    userId,
    authInitialized
  };
};

export default useAuth;

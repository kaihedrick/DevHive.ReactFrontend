import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth.ts';
import useRoutePermission from '../hooks/useRoutePermission';
import LoadingFallback from './LoadingFallback.tsx';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute
 * 
 * React component that guards routes based on authentication and project selection
 * 
 * STABILITY: This component is designed to prevent unnecessary unmounts/remounts during navigation.
 * It only redirects when auth state actually changes, not on every route change.
 * Uses debouncing to prevent redirects from transient state flips during React re-renders.
 * 
 * @param {React.ReactNode} children - Components to render if access is allowed
 * @returns {JSX.Element} Redirect to login or projects if access is denied
 */
// Task 3.1: Update ProtectedRoute to use userId instead of isAuthenticated
// Task 2: Block ALL redirects until auth is initialized
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { userId, isLoading, authInitialized } = useAuth();
  const { isRouteAllowed } = useRoutePermission();
  
  const prevRouteAllowedRef = useRef<boolean>(true);
  
  // Debounce isRouteAllowed to prevent transient flips
  const [debouncedRouteAllowed, setDebouncedRouteAllowed] = useState(isRouteAllowed);
  
  // Memoize route check
  const projectScopedRoutes = useMemo(() => [
    '/project-details', '/backlog', '/board', '/sprint', '/contacts', '/messages'
  ], []);
  
  const basePath = useMemo(() => '/' + location.pathname.split('/')[1], [location.pathname]);
  const requiresProject = useMemo(() => projectScopedRoutes.includes(basePath), [basePath, projectScopedRoutes]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRouteAllowed(isRouteAllowed);
    }, 100);
    return () => clearTimeout(timer);
  }, [isRouteAllowed]);

  // Task 2: Block ALL redirects until auth is initialized
  if (!authInitialized || isLoading) {
    return <LoadingFallback />;
  }

  // Task 3.1: Check userId, not isAuthenticated
  if (!userId) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  // Route requires project but not allowed
  if (!debouncedRouteAllowed && authInitialized && requiresProject) {
    const wasPreviouslyAllowed = prevRouteAllowedRef.current;
    if (wasPreviouslyAllowed === true) {
      return <Navigate to="/projects" replace />;
    }
    prevRouteAllowedRef.current = isRouteAllowed;
  } else {
    prevRouteAllowedRef.current = isRouteAllowed;
  }

  return <>{children}</>;
};

export default ProtectedRoute;








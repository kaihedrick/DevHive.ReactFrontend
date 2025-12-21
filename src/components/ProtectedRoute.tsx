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
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { isRouteAllowed } = useRoutePermission();
  
  // Track previous auth state to detect actual changes (not just re-renders)
  const prevAuthStateRef = useRef<{ isAuthenticated: boolean; isLoading: boolean } | null>(null);
  const prevRouteAllowedRef = useRef<boolean>(true); // Default to true to prevent initial redirects
  const hasInitializedRef = useRef<boolean>(false);
  
  // Debounce isRouteAllowed to prevent transient flips from causing redirects
  const [debouncedRouteAllowed, setDebouncedRouteAllowed] = useState(isRouteAllowed);
  
  // Memoize route check to prevent recalculation on every render
  const projectScopedRoutes = useMemo(() => [
    '/project-details', '/backlog', '/board', '/sprint', '/contacts', '/messages'
  ], []);
  
  const basePath = useMemo(() => '/' + location.pathname.split('/')[1], [location.pathname]);
  const requiresProject = useMemo(() => projectScopedRoutes.includes(basePath), [basePath, projectScopedRoutes]);
  
  // Debounce isRouteAllowed changes to prevent transient flips
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRouteAllowed(isRouteAllowed);
    }, 100); // 100ms debounce - wait for state to stabilize
    
    return () => clearTimeout(timer);
  }, [isRouteAllowed]);
  
  // Track auth state and route permission changes (not just route changes)
  useEffect(() => {
    const currentAuthState = { isAuthenticated, isLoading };
    const prevAuthState = prevAuthStateRef.current;
    
    // Only log on actual auth state changes, not route changes
    if (!prevAuthState || 
        prevAuthState.isAuthenticated !== currentAuthState.isAuthenticated ||
        prevAuthState.isLoading !== currentAuthState.isLoading) {
      console.log("ProtectedRoute - Auth state changed:", {
        path: location.pathname,
        isAuthenticated,
        isLoading,
        isRouteAllowed
      });
      prevAuthStateRef.current = currentAuthState;
    }
    
    // Track route permission changes
    if (prevRouteAllowedRef.current !== isRouteAllowed) {
      // Only log if permission actually changed (not just route change)
      if (prevRouteAllowedRef.current !== undefined) {
        console.log("ProtectedRoute - Route permission changed:", {
          path: location.pathname,
          isRouteAllowed,
          requiresProject
        });
      }
      prevRouteAllowedRef.current = isRouteAllowed;
    }
    
    // Mark as initialized after first render
    if (!hasInitializedRef.current && !isLoading) {
      hasInitializedRef.current = true;
    }
  }, [isAuthenticated, isLoading, isRouteAllowed, location.pathname, requiresProject]);

  // Wait for auth initialization to complete before making decisions
  // Don't redirect during loading - wait for auth state to be determined
  if (isLoading) {
    // Only show loading on initial load, not during navigation
    if (!hasInitializedRef.current) {
      return <LoadingFallback />;
    }
    // If already initialized, trust the previous auth state during brief loading states
    // This prevents redirects during token refresh or brief state updates
  }

  // If not authenticated, redirect to login
  // Only redirect if this is a real auth state change, not a transient state
  if (!isAuthenticated && hasInitializedRef.current) {
    // Only log redirect on actual auth loss, not on every route change
    if (prevAuthStateRef.current?.isAuthenticated) {
      console.log("🚫 Not authenticated, redirecting to login from:", location.pathname);
    }
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  // If authenticated but route not allowed (project required)
  // IMPORTANT: Don't treat "403/unauthorized for this project" as "unauthenticated"
  // Only redirect if there's truly no project selected (not just loading)
  // CRITICAL: Use debounced value to prevent redirects from transient state flips
  if (!debouncedRouteAllowed && hasInitializedRef.current && requiresProject) {
    // Only redirect if this is a real permission change (was allowed, now not allowed)
    // Don't redirect if we're just navigating between project-scoped routes
    const wasPreviouslyAllowed = prevRouteAllowedRef.current;
    // Only redirect if it was previously allowed and now it's not (actual permission loss)
    // If it was already not allowed, don't redirect again (prevents redirect loops)
    if (wasPreviouslyAllowed === true) {
      // This is a real restriction change - redirect
      console.log("🔒 Route requires project, redirecting to projects from:", location.pathname);
      return <Navigate to="/projects" replace />;
    }
    // If wasPreviouslyAllowed is false/undefined, this is likely:
    // 1. Initial load (undefined) - wait for initialization
    // 2. Already restricted (false) - don't redirect again
    // 3. Transient state during navigation - don't redirect
  }

  // If authenticated and route allowed, render children
  // Don't log on every render - only on actual state changes (handled in useEffect above)
  return <>{children}</>;
};

export default ProtectedRoute;








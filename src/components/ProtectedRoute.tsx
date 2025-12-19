import React, { useEffect } from 'react';
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
 * @param {React.ReactNode} children - Components to render if access is allowed
 * @returns {JSX.Element} Redirect to login or projects if access is denied
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { isRouteAllowed } = useRoutePermission();
  
  // Debug logging
  useEffect(() => {
    console.log("ProtectedRoute - Current path:", location.pathname);
    console.log("ProtectedRoute - isAuthenticated:", isAuthenticated);
    console.log("ProtectedRoute - isLoading:", isLoading);
    console.log("ProtectedRoute - isRouteAllowed:", isRouteAllowed);
  }, [location.pathname, isAuthenticated, isLoading, isRouteAllowed]);

  // Wait for auth initialization to complete before making decisions
  if (isLoading) {
    console.log("⏳ Auth state loading, waiting...");
    return <LoadingFallback />;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    console.log("🚫 Not authenticated, redirecting to login from:", location.pathname);
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  // If authenticated but route not allowed (project required), redirect to projects
  if (!isRouteAllowed) {
    console.log("🔒 Route not allowed, redirecting to projects from:", location.pathname);
    return <Navigate to="/projects" replace />;
  }

  // If authenticated and route allowed, render children
  console.log("✅ Access granted to:", location.pathname);
  return <>{children}</>;
};

export default ProtectedRoute;








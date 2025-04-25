import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useRoutePermission from '../hooks/useRoutePermission';

/**
 * ProtectedRoute
 * 
 * React component that guards routes based on authentication and project selection
 * 
 * @param {React.ReactNode} children - Components to render if access is allowed
 * @returns {JSX.Element} Redirect to login or projects if access is denied
 * 
 * @behavior 
 * - Uses useAuth() to check if user is authenticated
 * - Uses useRoutePermission() to check if route is accessible based on project context
 * - Logs route evaluation and redirects when necessary
 * - Preserves original navigation intent using state object when redirecting
 */
const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isRouteAllowed } = useRoutePermission();
  
  // Debug logging
  useEffect(() => {
    console.log("ProtectedRoute - Current path:", location.pathname);
    console.log("ProtectedRoute - isAuthenticated:", isAuthenticated);
    console.log("ProtectedRoute - isRouteAllowed:", isRouteAllowed);
  }, [location.pathname, isAuthenticated, isRouteAllowed]);

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
  return children;
};

export default ProtectedRoute;

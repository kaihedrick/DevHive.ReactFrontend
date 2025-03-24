import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useRoutePermission from '../hooks/useRoutePermission';

/**
 * Protected Route component that handles authentication and route protection
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

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSelectedProject } from '../services/projectService';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('authToken') !== null;
  const selectedProject = getSelectedProject();
  const location = useLocation();

  console.log("ProtectedRoute check - isAuthenticated:", isAuthenticated);
  console.log("ProtectedRoute check - selectedProject:", selectedProject);

  if (!isAuthenticated) {
    console.warn("User not authenticated. Redirecting to login...");
    return <Navigate to="/login" replace />;
  }

  // Allow access to the projects page even if no project is selected
  if (!selectedProject && location.pathname !== "/projects") {
    console.warn("No project selected. Redirecting to projects.");
    return <Navigate to="/projects" replace />;
  }

  return children;
};

export default ProtectedRoute;

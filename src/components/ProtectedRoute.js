import React, { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSelectedProject } from '../services/projectService';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  
  // Memoize these values to prevent unnecessary recalculations
  const authData = useMemo(() => ({
    isAuthenticated: localStorage.getItem('authToken') !== null,
    selectedProject: getSelectedProject()
  }), []);

  const { isAuthenticated, selectedProject } = authData;

  if (process.env.NODE_ENV === 'development') {
    console.log("ProtectedRoute check - isAuthenticated:", isAuthenticated);
    console.log("ProtectedRoute check - selectedProject:", selectedProject);
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Allow access to the projects page even if no project is selected
  if (!selectedProject && location.pathname !== "/projects") {
    return <Navigate to="/projects" replace />;
  }

  return children;
};

export default React.memo(ProtectedRoute);

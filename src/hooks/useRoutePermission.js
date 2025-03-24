import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { getSelectedProject } from '../services/authService.ts';

/**
 * Custom hook to check if the current route is allowed based on application state
 * @returns {Object} Route permission state
 */
const useRoutePermission = () => {
  const location = useLocation();
  
  // Routes that are accessible without a selected project
  const allowedWithoutProject = [
    "/projects", 
    "/account",
    "/account-details",
    "/join-project",
    "/create-project",
    "/forgot-password",
    "/reset-password"
  ];

  // Get selected project and calculate if the route is allowed
  const { selectedProject, isRouteAllowed } = useMemo(() => {
    const selectedProject = getSelectedProject();
    const basePath = '/' + location.pathname.split('/')[1];
    
    const pathIsAllowed = allowedWithoutProject.includes(basePath);
    const isRouteAllowed = !!selectedProject || pathIsAllowed;
    
    return { selectedProject, isRouteAllowed };
  }, [location.pathname]);

  return { 
    selectedProject,
    isRouteAllowed
  };
};

export { useRoutePermission };
export default useRoutePermission;
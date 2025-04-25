import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { getSelectedProject } from '../services/authService.ts';

/**
 * useRoutePermission
 *
 * Custom hook to determine route access permissions based on the presence of a selected project.
 *
 * @returns {Object} Route access state including:
 *  - selectedProject: The ID of the currently selected project from local storage.
 *  - isRouteAllowed: Boolean indicating if the current route is accessible.
 *
 * This hook is typically used to guard routes in apps where certain views require a selected project context.
 *
 * @example
 * const { isRouteAllowed } = useRoutePermission();
 * if (!isRouteAllowed) navigate("/projects");
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
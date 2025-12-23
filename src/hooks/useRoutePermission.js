import { useLocation } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { getSelectedProject } from '../services/storageService';
import { getUserId } from '../services/authService.ts';

/**
 * useRoutePermission
 *
 * Custom hook to determine route access permissions based on the presence of a selected project.
 * 
 * STABILITY: This hook uses useState to maintain stable selectedProject across route navigations.
 * It only updates when localStorage actually changes, not when location.pathname changes.
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
  const allowedWithoutProject = useMemo(() => [
    "/projects", 
    "/account",
    "/account-details",
    "/create-project",
    "/forgot-password",
    "/reset-password",
    "/invite" // Invite acceptance page (public route)
  ], []);

  // Read project once on initialization - use useState to keep it stable
  const [selectedProject, setSelectedProject] = useState(() => {
    const currentUserId = getUserId();
    return getSelectedProject(currentUserId);
  });
  
  // Only update selectedProject when storage actually changes (cross-tab or explicit set)
  // NOT when route changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Check for user-scoped key (selectedProjectId:{userId}) or legacy key
      if (e.key && e.key.startsWith('selectedProjectId')) {
        const currentUserId = getUserId();
        setSelectedProject(getSelectedProject(currentUserId));
      }
    };

    // Also listen for custom event in case same-tab changes occur
    const handleProjectChange = () => {
      const currentUserId = getUserId();
      setSelectedProject(getSelectedProject(currentUserId));
    };

    // Re-read project when auth state changes (e.g., after token refresh)
    // This ensures project ID is found after auth is fully ready
    const handleAuthStateChange = () => {
      const currentUserId = getUserId();
      const project = getSelectedProject(currentUserId);
      console.log('📦 useRoutePermission: Auth state changed, re-reading project:', {
        userId: currentUserId ? '(present)' : '(null)',
        project: project ? '(found)' : '(null)'
      });
      setSelectedProject(project);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('project-changed', handleProjectChange);
    window.addEventListener('auth-state-changed', handleAuthStateChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('project-changed', handleProjectChange);
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
  }, []);

  // Calculate route permission based on stable selectedProject
  // Only recalculate when selectedProject or pathname changes
  const isRouteAllowed = useMemo(() => {
    const basePath = '/' + location.pathname.split('/')[1];
    const pathIsAllowed = allowedWithoutProject.includes(basePath);
    return !!selectedProject || pathIsAllowed;
  }, [selectedProject, location.pathname, allowedWithoutProject]);

  return { 
    selectedProject,
    isRouteAllowed
  };
};

export { useRoutePermission };
export default useRoutePermission;
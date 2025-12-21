import { useQuery } from '@tanstack/react-query';
import { fetchUserProjects } from '../services/projectService';
import { getUserId } from '../services/authService.ts';
import { projectKeys } from './useProjects.ts';

/**
 * Hook to validate project access and get user role
 * 
 * Validates if a projectId belongs to the current user's accessible projects
 * and provides the user's role in that project.
 * 
 * NOTE: This hook is used inside AuthContext, so it cannot use useAuthContext.
 * Instead, it checks auth state directly via localStorage/token to break the circular dependency.
 * 
 * @returns Object with validation functions
 */
export function useValidateProjectAccess() {
  // Check auth state directly (not via context) to avoid circular dependency
  // AuthProvider → useValidateProjectAccess → useAuthContext → AuthProvider (circular!)
  const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('token') : false;
  const userId = getUserId();
  
  // Use useQuery directly instead of useProjects to avoid circular dependency
  const { data: projectsData, isLoading } = useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => fetchUserProjects(),
    enabled: hasToken && !!userId, // Check auth directly, not via context
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    retry: (failureCount, error: any) => {
      // Don't retry on 401 - token refresh should handle it
      if (error?.status === 401 || error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
  });
  
  // Extract projects array from response
  const projects = Array.isArray(projectsData) 
    ? projectsData 
    : (projectsData?.projects || []);
  
  /**
   * Validates if a projectId exists in the user's accessible projects
   * IMPORTANT: Only validates when projects are loaded and not empty
   * Returns false during loading to prevent premature clearing of valid selections
   * 
   * @param projectId - The project ID to validate
   * @returns true if project is accessible, false otherwise (or during loading)
   */
  const validateProjectId = (projectId: string | null | undefined): boolean => {
    // Don't validate if still loading - wait for projects to be ready
    // Returning false during loading prevents premature clearing, but callers should
    // check isLoading first to avoid calling this during loading
    if (isLoading) {
      console.log('⏳ Projects still loading, cannot validate projectId:', projectId);
      return false; // Return false during loading to prevent premature clearing
    }
    
    if (!projectId) {
      return false;
    }
    
    // Don't validate if projects array is empty or not loaded yet
    // This is a safety check - callers should also check projects.length before calling
    if (!projects || projects.length === 0) {
      console.warn('⚠️ Projects array is empty, cannot validate projectId:', projectId);
      return false;
    }
    
    // Check if projectId exists in user's accessible projects (owned OR member)
    // This is the correct check - it validates against the projects list which includes
    // both owned projects AND projects where user is a member
    const isValid = projects.some((p: any) => p.id === projectId);
    
    if (!isValid) {
      console.warn('⚠️ ProjectId not found in user projects:', {
        projectId,
        availableProjects: projects.map((p: any) => ({ id: p.id, name: p.name, userRole: p.userRole }))
      });
    } else {
      const project = projects.find((p: any) => p.id === projectId);
      console.log('✅ ProjectId validated:', {
        projectId,
        projectName: project?.name,
        userRole: project?.userRole
      });
    }
    
    return isValid;
  };
  
  /**
   * Gets the user's role in a specific project
   * @param projectId - The project ID
   * @returns User role ('owner' | 'admin' | 'member' | 'viewer') or null if not found
   */
  const getProjectRole = (projectId: string | null | undefined): string | null => {
    if (!projectId || !projects || projects.length === 0) {
      return null;
    }
    
    const project = projects.find((p: any) => p.id === projectId);
    return project?.userRole || null;
  };
  
  /**
   * Gets permissions for a specific project
   * @param projectId - The project ID
   * @returns Permissions object or null if not found
   */
  const getProjectPermissions = (projectId: string | null | undefined): any | null => {
    if (!projectId || !projects || projects.length === 0) {
      return null;
    }
    
    const project = projects.find((p: any) => p.id === projectId);
    return project?.permissions || null;
  };
  
  return {
    validateProjectId,
    getProjectRole,
    getProjectPermissions,
    projects,
    isLoading,
  };
}


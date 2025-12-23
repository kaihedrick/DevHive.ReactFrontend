import { useState, useEffect, useCallback } from 'react';
import { getSelectedProject, setSelectedProject as setSelectedProjectStorage, clearSelectedProject } from '../services/storageService';
import { useValidateProjectAccess } from './useValidateProjectAccess';
import { getUserId } from '../services/authService.ts';

/**
 * Hook to manage project selection with validation
 * 
 * Features:
 * - Validates selectedProjectId against user's accessible projects
 * - Clears stale projectId when switching accounts
 * - Auto-selects project if user has exactly one project
 * - Provides safe project selection methods
 * 
 * @returns Object with selectedProjectId, setter, and validation functions
 */
export function useProjectSelection() {
  const { validateProjectId, projects, isLoading } = useValidateProjectAccess();
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null);
  
  /**
   * Safe setter that validates projectId before setting
   */
  const setSelectedProject = useCallback((projectId: string | null) => {
    const currentUserId = getUserId();
    
    if (!projectId) {
      clearSelectedProject(currentUserId);
      setSelectedProjectIdState(null);
      return;
    }
    
    // Validate projectId before setting (only if projects are loaded)
    if (!isLoading && validateProjectId(projectId)) {
      setSelectedProjectIdState(projectId);
      setSelectedProjectStorage(projectId, currentUserId); // Update localStorage scoped to user
    } else if (!isLoading) {
      // Only warn if projects are loaded - during loading, validation returns false
      console.warn('⚠️ Attempted to select invalid project:', projectId);
      clearSelectedProject(currentUserId);
      setSelectedProjectIdState(null);
    }
  }, [validateProjectId, isLoading]);
  
  /**
   * Validates and loads stored projectId on mount or when projects change
   */
  useEffect(() => {
    // Wait for projects to finish loading
    if (isLoading) {
      return;
    }
    
    // Don't proceed if projects array is empty (user has no projects)
    if (!projects || projects.length === 0) {
      console.log('ℹ️ No projects available for user');
      return;
    }
    
    const currentUserId = getUserId();
    const stored = getSelectedProject(currentUserId);
    
    if (stored) {
      // Validate stored projectId
      if (validateProjectId(stored)) {
        console.log('✅ Stored projectId is valid:', stored);
        setSelectedProjectIdState(stored);
      } else {
        // Stale projectId - clear it
        console.warn('⚠️ Stored projectId is not accessible, clearing...', {
          stored,
          availableProjects: projects.map((p: any) => ({ id: p.id, name: p.name, userRole: p.userRole }))
        });
        clearSelectedProject(currentUserId);
        setSelectedProjectIdState(null);
        
        // Auto-select first project after clearing invalid one
        if (projects.length > 0) {
          const projectId = projects[0].id;
          console.log('✅ Auto-selecting first project after clearing invalid selection:', projectId);
          setSelectedProjectIdState(projectId);
          setSelectedProjectStorage(projectId, currentUserId);
        }
      }
    } else if (projects.length === 1) {
      // Auto-select if only one project
      const projectId = projects[0].id;
      console.log('✅ Auto-selecting single project:', projectId);
      setSelectedProjectIdState(projectId);
      setSelectedProjectStorage(projectId, currentUserId);
    } else if (projects.length > 1) {
      // Multiple projects - auto-select first one (most recent)
      const projectId = projects[0].id;
      console.log('✅ Auto-selecting first project:', projectId);
      setSelectedProjectIdState(projectId);
      setSelectedProjectStorage(projectId, currentUserId);
    }
  }, [projects, isLoading, validateProjectId]);
  
  return {
    selectedProjectId,
    setSelectedProject,
    validateProjectId,
    isLoading,
  };
}





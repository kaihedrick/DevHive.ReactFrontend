import { useState, useEffect, useCallback } from 'react';
import { 
  fetchUserProjects, 
  deleteProject as deleteProjectAPI, 
  fetchProjectById 
} from "../services/projectService";
import { UseProjectsReturn, UseProjectReturn, Project } from '../types/hooks.ts';

/**
 * useProjects
 *
 * Custom hook for fetching and managing a list of projects associated with the current user.
 *
 * @returns {UseProjectsReturn} Projects state and operations
 */
export const useProjects = (): UseProjectsReturn => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async (): Promise<void> => {
      try {
        setLoading(true);
        const response = await fetchUserProjects({ limit: 50, offset: 0 });
        // The new API returns { projects: [...], limit: 20, offset: 0 }
        // Extract the projects array from the response
        setProjects(response.projects || []);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load projects');
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const deleteProject = async (projectId: string): Promise<void> => {
    try {
      await deleteProjectAPI(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
      console.error('Failed to delete project:', err);
      throw err;
    }
  };

  return {
    projects,
    loading,
    error,
    deleteProject
  };
};

/**
 * useProject
 *
 * Custom hook for fetching and managing a single project by ID.
 *
 * @param {string} projectId - The ID of the project to fetch.
 * @returns {UseProjectReturn} Project state and operations
 */
export const useProject = (projectId: string): UseProjectReturn => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchProjectById(projectId);
      setProject(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load project');
      console.error('❌ Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const refreshProject = useCallback((): Promise<void> => {
    return fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return {
    project,
    loading,
    error,
    refreshProject
  };
};

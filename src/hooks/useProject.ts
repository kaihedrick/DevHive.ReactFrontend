import { useState, useCallback, useEffect } from 'react';
import { fetchProjectById } from '../services/projectService';
import { Project } from '../types/hooks';

export interface UseProjectReturn {
  project: Project | null;
  loading: boolean;
  error: string | null;
  refreshProject: () => Promise<void>;
}

/**
 * useProject
 *
 * Custom hook to manage project data retrieval and state.
 *
 * @param projectId - The ID of the project to fetch.
 * @returns An object containing project data, loading state, error, and refresh function.
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
      setError(err.message || "Failed to load project");
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








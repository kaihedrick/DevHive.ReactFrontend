import { useState, useCallback, useEffect } from 'react';
import { fetchProjectById } from '../services/projectService';
/**
 * useProject
 *
 * Custom hook to manage project data retrieval and state.
 *
 * @param {string} projectId - The ID of the project to fetch.
 * @returns {Object} An object containing:
 *  - project: The fetched project data.
 *  - loading: Boolean indicating loading state.
 *  - error: Any error encountered during fetch.
 *  - refreshProject: Function to re-fetch the project data.
 *
 * @example
 * const { project, loading, error, refreshProject } = useProject("abc123");
 */
export const useProject = (projectId) => {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchProjectById(projectId);
      setProject(data);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load project");
      console.error('❌ Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const refreshProject = useCallback(() => {
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
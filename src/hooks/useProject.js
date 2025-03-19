import { useState, useCallback, useEffect } from 'react';
import { fetchProjectById } from '../services/projectService';

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
      setError(err.message);
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
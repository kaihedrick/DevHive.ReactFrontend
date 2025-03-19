import { useState, useCallback, useEffect } from 'react';
import * as projectService from '../services/projectService';

export const useProjectSprints = (projectId) => {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSprints = useCallback(async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      const data = await projectService.fetchProjectSprints(projectId);
      setSprints(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createSprint = useCallback(async (sprintData) => {
    try {
      await projectService.createSprint({ ...sprintData, projectID: projectId });
      await fetchSprints(); // Refresh sprints after creation
    } catch (err) {
      setError(err.message);
    }
  }, [projectId, fetchSprints]);

  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);

  return { sprints, loading, error, refreshSprints: fetchSprints, createSprint };
};
import { useState, useCallback, useEffect } from 'react';
import * as projectService from '../services/projectService';
/**
 * useProjectSprints
 *
 * Custom React hook for managing and interacting with sprints in a given project.
 *
 * @param {string} projectId - The ID of the project for which sprints should be fetched and managed.
 *
 * @returns {Object} An object containing:
 *  - sprints: An array of sprints associated with the project.
 *  - loading: Boolean indicating whether sprint data is currently being loaded.
 *  - error: Any error encountered during sprint operations.
 *  - refreshSprints: Function to re-fetch the list of sprints.
 *  - createSprint: Function to create a new sprint and refresh the sprint list.
 *
 * @example
 * const { sprints, loading, error, refreshSprints, createSprint } = useProjectSprints("project123");
 */
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
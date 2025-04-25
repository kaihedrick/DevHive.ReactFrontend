import { useState, useEffect, useCallback } from 'react';
import { 
  fetchUserProjects, 
  deleteProject as deleteProjectAPI, 
  fetchProjectById 
} from "../services/projectService";
/**
 * useProjects
 *
 * Custom hook for fetching and managing a list of projects associated with the current user.
 *
 * @returns {Object} An object containing:
 *  - projects: Array of user projects.
 *  - loading: Boolean indicating loading state.
 *  - error: Any error encountered during fetch.
 *  - deleteProject: Function to delete a project by its ID.
 *
 * @example
 * const { projects, loading, error, deleteProject } = useProjects();
 */
const useProjects = (userId) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const data = await fetchUserProjects();
        setProjects(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    };

    // We only need to check if user is logged in to load projects
    // The userId from props is no longer needed as we get it from authService
    loadProjects();
  }, []);

  const deleteProject = async (projectId) => {
    try {
      await deleteProjectAPI(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (err) {
      setError(err.message);
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
 * @returns {Object} An object containing:
 *  - project: Project details.
 *  - loading: Boolean indicating loading state.
 *  - error: Any error encountered during fetch.
 *  - refreshProject: Function to manually re-fetch project data.
 *
 * @example
 * const { project, loading, error, refreshProject } = useProject("abc123");
 */
const useProject = (projectId) => {
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

export { useProjects, useProject };


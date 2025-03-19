import { useState, useEffect, useCallback } from 'react';
import { 
  fetchUserProjects, 
  deleteProject as deleteProjectAPI, 
  fetchProjectById 
} from "../services/projectService";

const useProjects = (userId) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const data = await fetchUserProjects(userId);
        setProjects(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadProjects();
    }
  }, [userId]);

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


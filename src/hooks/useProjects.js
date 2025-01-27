import { useState, useEffect } from "react";
import { fetchUserProjects, getSelectedProject, setSelectedProject, getUserId } from "../services/projectService";

// Custom hook for managing project state
const useProjects = (providedUserId) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProjectState] = useState(getSelectedProject());

  // Retrieve user ID if not provided
  const userId = providedUserId || getUserId();

  useEffect(() => {
    if (!userId) {
      console.error("Error: User ID is missing. Please log in again.");
      setLoading(false);
      return;
    }

    const getProjects = async () => {
      try {
        const data = await fetchUserProjects();
        setProjects(data);
      } catch (error) {
        console.error("Failed to fetch projects:", error.message);
      } finally {
        setLoading(false);
      }
    };

    getProjects();
  }, [userId]);

  // Function to select a project
  const selectProject = (projectId) => {
    setSelectedProject(projectId);
    setSelectedProjectState(projectId);
  };

  return {
    projects,
    loading,
    selectedProject,
    selectProject,
  };
};

export default useProjects;

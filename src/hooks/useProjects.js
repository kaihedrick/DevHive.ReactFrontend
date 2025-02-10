import { useState, useEffect } from "react";
import {
  fetchUserProjects,
  getSelectedProject,
  setSelectedProject,
  getUserId,
  deleteProject as deleteProjectAPI, // Import deleteProject API function
} from "../services/projectService";

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

  // Function to delete a project
  const deleteProject = async (projectId) => {
    if (!projectId) return;

    try {
      console.log(`🗑️ Deleting project with ID: ${projectId}`);
      await deleteProjectAPI(projectId); // Call the API function
      setProjects((prev) => prev.filter((project) => project.id !== projectId)); // Remove project from state
      console.log(`✅ Successfully deleted project: ${projectId}`);
    } catch (error) {
      console.error("❌ Failed to delete project:", error.message);
      throw error;
    }
  };

  // Return values from hook
  return {
    projects,
    loading,
    selectedProject,
    selectProject,
    deleteProject, // Return deleteProject function
  };
};

// Ensure this is at the top level (not inside any function)
export default useProjects;

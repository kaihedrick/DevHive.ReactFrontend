import React, { useState, useEffect } from "react";
import { fetchUserProjects } from "../services/projectService"; // Updated import
import "../styles/projects.css"; // Ensure correct CSS path

const Projects = () => {
  const [projects, setProjects] = useState([]); // Handle multiple projects
  const [loading, setLoading] = useState(true);
  const userId = localStorage.getItem("userId"); // Assuming user ID is stored in local storage

  useEffect(() => {
    const getProjects = async () => {
      if (!userId) {
        console.error("User ID is missing.");
        setLoading(false);
        return;
      }

      try {
        const data = await fetchUserProjects(userId); // Fetch user-specific projects
        setProjects(data);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setLoading(false);
      }
    };

    getProjects();
  }, [userId]);

  return (
    <div className="projects-container">
      <div className="header">
        <h1>Welcome to DevHive</h1>
        <p>Your Projects:</p>
      </div>

      {loading ? (
        <p className="loading">Loading projects...</p>
      ) : (
        <div className="projects-list">
          {projects && projects.length > 0 ? (
            projects.map((project) => (
              <div key={project.id} className="project-card">
                <h3>{project.name}</h3>
                <p>{project.description}</p>
              </div>
            ))
          ) : (
            <p>No projects available.</p>
          )}
        </div>
      )}

      <div className="actions">
        <button className="action-btn create-btn">Create a Project</button>
        <button className="action-btn join-btn">Join a Group</button>
        <button className="action-btn account-btn">Account Details</button>
      </div>
    </div>
  );
};

export default Projects;

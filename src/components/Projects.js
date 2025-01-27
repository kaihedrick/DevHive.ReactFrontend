import React, { useState, useEffect } from "react";
import useProjects from "../hooks/useProjects.js";
import { useNavigate } from "react-router-dom";
import "../styles/projects.css";

const Projects = () => {
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();
  console.log("Projects component is rendering...");

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
  
    if (storedUserId && storedUserId !== userId) {
      console.log("Setting user ID from localStorage:", storedUserId);
      setUserId(storedUserId);
    } else if (!storedUserId) {
      console.error("User ID not found. Redirecting to login.");
      navigate("/");
    }
  }, [navigate, userId]);
  
  
  const { projects, loading, selectProject } = useProjects(userId);

  const handleProjectSelection = (projectId) => {
    selectProject(projectId);
    localStorage.setItem("selectedProjectId", projectId);
    navigate(`/project-details`);
  };
  

  if (loading) return <p className="loading">Loading projects...</p>;

  return (
    <div className="projects-container">
      <div className="header">
        <h1>Welcome to DevHive</h1>
        <p>Your Projects:</p>
      </div>

      <div className="projects-list">
        {projects.length > 0 ? (
          projects.map((project) => (
            <ProjectCard key={project.id} project={project} onSelect={handleProjectSelection} />
          ))
        ) : (
          <p>No projects available.</p>
        )}
      </div>

      <div className="actions">
        <button className="action-btn create-btn" onClick={() => navigate("/create-project")}>
          Create a Project
        </button>
        <button className="action-btn join-btn" onClick={() => navigate("/join-group")}>
          Join a Group
        </button>
        <button className="action-btn account-btn" onClick={() => navigate("/account-details")}>
          Account Details
        </button>
      </div>
    </div>
  );
};

const ProjectCard = ({ project, onSelect }) => (
  <div 
    className="project-card" 
    onClick={() => onSelect(project.id)} 
    tabIndex="0"
    role="button"
    aria-label={`View project ${project.name}`}
    onKeyPress={(e) => e.key === 'Enter' && onSelect(project.id)}
  >
    <h3>{project.name}</h3>
    <p>{project.description}</p>
  </div>
);

export default Projects;

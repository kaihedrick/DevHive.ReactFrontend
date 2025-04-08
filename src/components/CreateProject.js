import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "../services/projectService";
import { getUserId } from "../services/authService"; // Import getUserId to get current user ID
import DevHiveLogo from "./assets/DevHiveLogo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import "../styles/create_project.css";

const CreateProject = () => {
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }
    
    try {
      const userId = getUserId(); // Get the current logged-in user ID
      
      if (!userId) {
        setError("You must be logged in to create a project");
        return;
      }
      
      // Create project with all required fields
      await createProject({
        name: projectName,
        description: projectDescription,
        projectOwnerID: userId // Include the project owner ID
      });
      
      alert("Project created successfully!");
      navigate("/projects");
    } catch (error) {
      console.error("Error creating project:", error);
      setError(error.response?.data || "Failed to create project. Please try again.");
    }
  };

  return (
    <div className="create-project-container">
      <div className="back-arrow" onClick={() => navigate("/projects")}>
        <FontAwesomeIcon icon={faArrowRotateLeft} />
      </div>

      <img src={DevHiveLogo} alt="DevHive Logo" className="logo" />
      <h2>Create Project</h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          required
        />

        <textarea
          placeholder="Enter Description"
          value={projectDescription}
          onChange={(e) => setProjectDescription(e.target.value)}
          required
        ></textarea>

        <button type="submit" className="create-project-btn">
          Create Project
        </button>
      </form>

      <footer>Copyright</footer>
    </div>
  );
};

export default CreateProject;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "../services/projectService";
import { getUserId } from "../services/authService";
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

    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    try {
      const userId = getUserId();

      if (!userId) {
        setError("You must be logged in to create a project");
        return;
      }

      await createProject({
        name: projectName,
        description: projectDescription,
        projectOwnerID: userId,
      });

      alert("Project created successfully!");
      navigate("/projects");
    } catch (error) {
      console.error("Error creating project:", error);
      setError(error.response?.data || "Failed to create project. Please try again.");
    }
  };

  return (
    <div className="create-project-page">
      <div className="create-project-container">
        <div className="back-arrow" onClick={() => navigate("/projects")}>
          <FontAwesomeIcon icon={faArrowRotateLeft} />
        </div>

        <h1 className="create-project-title">Create Project</h1>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Project Name Input with Counter */}
          <div className="input-container">
            <input
              type="text"
              placeholder="Enter Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              maxLength={50}
              required
            />
            <span className="char-counter">{projectName.length} / 50</span>
          </div>

          {/* Project Description Input with Counter */}
          <div className="input-container">
            <textarea
              placeholder="Enter Description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              maxLength={255}
              required
            ></textarea>
            <span className="char-counter">{projectDescription.length} / 255</span>
          </div>

          <button type="submit" className="create-project-btn">
            Create Project
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateProject;

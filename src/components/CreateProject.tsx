import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateProject } from "../hooks/useProjects.ts";
import { getUserId } from "../services/authService";
import { useScrollIndicators } from "../hooks/useScrollIndicators.ts";
import "../styles/create_project.css";
import "../styles/create_sprint.css"; // Import for Apple-style layout
import "../styles/projects.css"; // Import for unified button styles

/**
 * CreateProject Component
 * 
 * Form component that allows a logged-in user to create a new project.
 */
const CreateProject: React.FC = () => {
  const [projectName, setProjectName] = useState<string>("");
  const [projectDescription, setProjectDescription] = useState<string>("");
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();
  const containerRef = useScrollIndicators([projectName, projectDescription, error]);
  const createProjectMutation = useCreateProject();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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

      await createProjectMutation.mutateAsync({
        name: projectName,
        description: projectDescription,
      });

      navigate("/projects");
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    }
  };

  return (
    <div ref={containerRef} className="create-sprint-container with-footer-pad">
      {/* Apple-style compact header */}
      <div className="create-sprint-nav-bar">
        <button className="back-nav-btn" onClick={() => navigate("/projects")}>
          Back
        </button>
        <h1 className="create-sprint-title">Create Project</h1>
        <div className="nav-spacer" />
      </div>

      <form onSubmit={handleSubmit} className="create-sprint-form">
        <div className="form-group">
          <label htmlFor="projectName" className="form-label">Project Name *</label>
          <input
            type="text"
            id="projectName"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="form-input"
            placeholder="Enter project name"
            maxLength={100}
          />
          <div className="character-count">
            {projectName.length}/100 characters
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="projectDescription" className="form-label">Project Description</label>
          <textarea
            id="projectDescription"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            className="form-input"
            placeholder="Enter project description (optional)"
            rows={4}
            maxLength={500}
          />
          <div className="character-count">
            {projectDescription.length}/500 characters
          </div>
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button 
            type="submit" 
            className="primary-action-btn"
            disabled={createProjectMutation.isPending}
          >
            {createProjectMutation.isPending ? "Creating..." : "Create Project"}
          </button>
          <button 
            type="button" 
            onClick={() => navigate("/projects")} 
            className="secondary-action-btn"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateProject;




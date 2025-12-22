import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateProject } from "../hooks/useProjects.ts";
import { getUserId } from "../services/authService.ts";
import { useScrollIndicators } from "../hooks/useScrollIndicators.ts";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea.ts";
import { isValidText } from "../utils/validation.ts";
import { useToast } from "../contexts/ToastContext.tsx";
import "../styles/create_project.css";
import "../styles/create_sprint.css"; // Import for Apple-style layout
import "../styles/projects.css"; // Import for unified button styles
import "../styles/project_details.css"; // Import for char-count styling

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
  const { showError: showToastError } = useToast();
  
  // Auto-resize textarea for description
  const descriptionTextareaRef = useAutoResizeTextarea(projectDescription, 4);

  // Handle input validation for project name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    if (value.length <= 255) {
      setProjectName(value);
    }
  };

  // Handle input validation for project description
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = e.target.value;
    if (value.length <= 255) {
      setProjectDescription(value);
    }
  };

  // Prevent invalid characters on keydown
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const char = e.key;
    if (char.length === 1 && !isValidText(char)) {
      e.preventDefault();
      showToastError("Invalid character. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.");
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const char = e.key;
    if (char.length === 1 && !isValidText(char)) {
      e.preventDefault();
      showToastError("Invalid character. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    // Validate project name
    if (!isValidText(projectName.trim())) {
      setError("Project name contains invalid characters. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.");
      return;
    }

    // Validate project description
    if (projectDescription.trim() && !isValidText(projectDescription.trim())) {
      setError("Project description contains invalid characters. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.");
      return;
    }

    try {
      const userId = getUserId();

      if (!userId) {
        setError("You must be logged in to create a project");
        return;
      }

      await createProjectMutation.mutateAsync({
        name: projectName.trim(),
        description: projectDescription.trim(),
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
            onChange={handleNameChange}
            onKeyDown={handleNameKeyDown}
            className="form-input"
            placeholder="Enter project name"
            maxLength={255}
          />
          <div className="char-count">
            {projectName.length}/255
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="projectDescription" className="form-label">Project Description</label>
          <textarea
            ref={descriptionTextareaRef}
            id="projectDescription"
            value={projectDescription}
            onChange={handleDescriptionChange}
            onKeyDown={handleDescriptionKeyDown}
            className="form-input"
            placeholder="Enter project description (optional)"
            rows={4}
            maxLength={255}
            style={{ resize: 'none', overflow: 'hidden' }}
          />
          <div className="char-count">
            {projectDescription.length}/255
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




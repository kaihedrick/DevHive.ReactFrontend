import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { joinProject, fetchProjectById, getUserId } from "../services/projectService";
import "../styles/join_project.css";
/**
 * JoinProject Component
 * 
 * Allows authenticated users to join an existing project using a unique project code.
 * Handles validation, API communication, navigation, and error/status feedback.
 * 
 * @returns {JSX.Element} Rendered form for joining a project
 */
const JoinProject = () => {
  /**
   * useNavigate
   * 
   * Provides client-side navigation to switch between routes
   */
  const navigate = useNavigate();
  const userId = getUserId();
  /**
   * useState - projectCode, status, error
   * 
   * projectCode: stores the input value of the join code
   * status: stores informational messages (e.g., "Joining project...")
   * error: stores error messages from failed validations or API calls
   */
  const [projectCode, setProjectCode] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  /**
   * handleProjectCodeChange
   * 
   * Updates the local state as the user types the project code
   * 
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input event
   */
  const handleProjectCodeChange = (e) => {
    setProjectCode(e.target.value);
  };
  /**
   * handleJoin
   * 
   * Validates input, checks if the project exists, and attempts to join the project
   * Displays success or error messages based on result
   * 
   * @async
   * @returns {Promise<void>}
   */
  const handleJoin = async () => {
    if (!projectCode) {
      setError("Please enter the project code.");
      return;
    }

    try {
      setStatus("Validating project code...");
      setError("");

      const projectData = await fetchProjectById(projectCode);
      if (!projectData) throw new Error("Invalid project code.");

      setStatus("Joining project...");
      await joinProject(projectCode, userId);

      setStatus("Successfully joined the project!");
      setTimeout(() => navigate("/projects"), 1500);
    } catch (err) {
      setError("Invalid project code or failed to join the project.");
      setStatus("");
    }
  };
  /**
   * handleBack
   * 
   * Navigates back to the main project list
   */
  const handleBack = () => {
    navigate("/projects");
  };

  return (
    <div className="join-project-page">
      <div className="join-project-container">
        <div className="join-project-card">
          {/* Back Arrow */}
          <div className="back-arrow" onClick={handleBack}>
            <FontAwesomeIcon icon={faArrowRotateLeft} />
          </div>

          {/* Title */}
          <h1 className="join-project-title">Join Project</h1>

          {/* Subtitle */}
          <p className="join-project-subtitle">Enter the project code to join</p>

          {/* Input Field */}
          <input
            type="text"
            value={projectCode}
            onChange={handleProjectCodeChange}
            placeholder="Enter Project Code"
            className="project-code-input"
          />

          {/* Join Button */}
          <button className="join-btn" onClick={handleJoin}>
            Join
          </button>

          {/* Status and Error Messages */}
          {status && <p className="status">{status}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default JoinProject;

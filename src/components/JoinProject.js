import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { joinProject, fetchProjectById, getUserId } from "../services/projectService";
import "../styles/join_project.css";

const JoinProject = () => {
  const navigate = useNavigate();
  const userId = getUserId();

  const [projectCode, setProjectCode] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const handleProjectCodeChange = (e) => {
    setProjectCode(e.target.value);
  };

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

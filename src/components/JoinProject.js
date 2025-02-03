import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinProject, fetchProjectById, getUserId } from "../services/projectService";
import "../styles/join_project.css";

const JoinProject = () => {
  const navigate = useNavigate();
  const userId = getUserId();

  const [projectCode, setProjectCode] = useState("");
  const [project, setProject] = useState(null); // ✅ Fixed syntax
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
      setProject(projectData);

      setStatus("Joining project...");
      await joinProject(projectCode, userId); // Uses the updated API structure

      setStatus("Successfully joined the project!");
      setTimeout(() => navigate("/projects"), 1500);
    } catch (err) {
      console.error("Error:", err);
      setError("Invalid project code or failed to join the project.");
      setStatus("");
    }
  };

  const handleBack = () => {
    navigate("/projects");
  };

  return (
    <div className="join-project-container">
      <div className="back-arrow" onClick={handleBack}>←</div>

      <h1>Join Group</h1>
      <p>Enter group code to join group</p>

      <input
        type="text"
        value={projectCode}
        onChange={handleProjectCodeChange}
        placeholder="Enter Project Code"
        className="project-code-input"
      />

      <button className="join-btn" onClick={handleJoin}>
        Join
      </button>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default JoinProject;

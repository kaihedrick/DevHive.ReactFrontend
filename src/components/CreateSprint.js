import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSprint, getSelectedProject } from "../services/projectService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import "../styles/create_sprint.css";

const CreateSprint = () => {
  const navigate = useNavigate();
  const projectID = getSelectedProject();
  const [sprintName, setSprintName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState(null);

  const handleCreateSprint = async () => {
    if (!sprintName || !startDate || !endDate) {
      setError("All fields are required.");
      setTimeout(() => setError(null), 2000);
      return;
    }

    try {
      const sprintData = {
        name: sprintName,
        startDate,
        endDate,
        isCompleted: false,
        isStarted: false,
        projectID,
      };

      await createSprint(sprintData);
      
      // ✅ Redirect to Backlog with Sprint Name in URL
      navigate(`/backlog?success=${encodeURIComponent(sprintName)}`);
    } catch (err) {
      setError(err.message || "Failed to create sprint.");
      setTimeout(() => setError(null), 2000);
    }
  };

  return (
    <div className="create-sprint-page">
      {/* 🔙 Back Arrow (Outside the Card, Top-Left of Page) */}
      <div className="back-arrow" onClick={() => navigate("/backlog")}>
        <FontAwesomeIcon icon={faArrowRotateLeft} />
      </div>

      <div className="create-sprint-container">
        <div className="card">
          <h2>Create Sprint</h2>

          <input
            type="text"
            placeholder="Enter Sprint Name"
            value={sprintName}
            onChange={(e) => setSprintName(e.target.value)}
          />

          <div className="input-group">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button className="button-primary" onClick={handleCreateSprint}>
            Create Sprint
          </button>

          {error && <div className="error-popup">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default CreateSprint;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSelectedProject } from "../services/projectService";
import { useSprintManagement } from "../hooks/useSprintManagement"; // Using named export
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCalendarAlt } from "@fortawesome/free-solid-svg-icons";
import "../styles/create_sprint.css";

const CreateSprint = () => {
  const navigate = useNavigate();
  const projectId = getSelectedProject();
  
  // State for form inputs
  const [sprintName, setSprintName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState(null);
  
  // Use the sprint management hook with named import
  const { 
    loading, 
    handleCreateSprint,
    validateSprintDates, 
    getSprintDisabledDates 
  } = useSprintManagement(projectId);
  
  // Get disabled dates for the date picker
  const disabledDates = getSprintDisabledDates();
  
  const handleCreateSprintSubmit = async () => {
    if (!sprintName || !startDate || !endDate) {
      setError("All fields are required.");
      setTimeout(() => setError(null), 2000);
      return;
    }
    
    // Validate sprint dates
    const validation = validateSprintDates(startDate, endDate);
    if (!validation.valid) {
      setError(validation.error);
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
        projectID: projectId,
      };

      const result = await handleCreateSprint(sprintData);
      
      if (result.success) {
        // Redirect to Backlog with success indicator
        navigate(`/backlog?success=${encodeURIComponent(sprintName)}`);
      } else {
        setError(result.error || "Failed to create sprint.");
        setTimeout(() => setError(null), 2000);
      }
    } catch (err) {
      setError(err.message || "Failed to create sprint.");
      setTimeout(() => setError(null), 2000);
    }
  };

  if (!projectId) {
    return (
      <div className="create-sprint-page">
        <div className="create-sprint-container">
          <div className="card">
            <div className="back-arrow" onClick={() => navigate("/backlog")}>
              <FontAwesomeIcon icon={faArrowRotateLeft} />
            </div>
            <h2>Error</h2>
            <p>No project selected. Please select a project first.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-sprint-page">
      <div className="create-sprint-container">
        <div className="card">
          {/* Back Arrow */}
          <div className="back-arrow" onClick={() => navigate("/backlog")}>
            <FontAwesomeIcon icon={faArrowRotateLeft} />
          </div>
          
          <h2>Create Sprint</h2>

          <input
            type="text"
            placeholder="Enter Sprint Name"
            value={sprintName}
            onChange={(e) => setSprintName(e.target.value)}
          />

          <div className="input-group">
            <label>
              <FontAwesomeIcon icon={faCalendarAlt} className="calendar-icon" /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]} // Cannot select dates in the past
              disabled={loading}
            />
            {disabledDates.length > 0 && (
              <div className="date-helper-text">
                Note: Some dates are unavailable due to existing sprints
              </div>
            )}
          </div>

          <div className="input-group">
            <label>
              <FontAwesomeIcon icon={faCalendarAlt} className="calendar-icon" /> End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]} // End date must be after start date
              disabled={loading}
            />
          </div>

          <button 
            className="button-primary" 
            onClick={handleCreateSprintSubmit}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Sprint"}
          </button>

          {error && <div className="error-popup">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default CreateSprint;

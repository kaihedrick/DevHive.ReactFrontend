import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSelectedProject } from "../services/storageService";
import { createSprint } from "../services/sprintService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCalendarAlt, faPlay } from "@fortawesome/free-solid-svg-icons";
import "../styles/create_sprint.css";
/**
 * CreateSprint Component
 * 
 * Provides UI and logic to create a new sprint for the currently selected project.
 * 
 * @returns {JSX.Element} Sprint creation form with validation and submission logic
 * 
 * @state sprintName - Sprint title entered by the user
 * @state startDate - Sprint start date (required)
 * @state endDate - Sprint end date (required)
 * @state startImmediately - Whether the sprint should be marked as started upon creation
 * @state loading - Tracks form submission state
 * @state error - Displays error messages to the user
 * 
 * @hook useNavigate - Allows programmatic navigation between routes
 * 
 * @method handleCreateSprintSubmit - Validates input and calls API to create a sprint
 * 
 * @conditional UI - If project is not selected, shows an error message with back navigation
 */

const CreateSprint = () => {
  const navigate = useNavigate();
  const projectId = getSelectedProject();
  
  // State for form inputs
  const [sprintName, setSprintName] = useState("");
  const [sprintDescription, setSprintDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startImmediately, setStartImmediately] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleCreateSprintSubmit = async () => {
    if (!sprintName || !startDate || !endDate) {
      setError("All fields are required.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    // Validate end date is after start date
    if (new Date(endDate) <= new Date(startDate)) {
      setError("End date must be after start date.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    try {
      setLoading(true);
      
      const sprintData = {
        name: sprintName,
        description: sprintDescription,
        startDate,
        endDate,
      };

      await createSprint(projectId, sprintData);
      navigate("/backlog");
    } catch (err) {
      setError(err.message || "Failed to create sprint.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
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

          <textarea
            placeholder="Enter Sprint Description (optional)"
            value={sprintDescription}
            onChange={(e) => setSprintDescription(e.target.value)}
            rows="3"
            className="sprint-description"
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
            />
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
            />
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={startImmediately}
                onChange={(e) => setStartImmediately(e.target.checked)}
              />
              <FontAwesomeIcon icon={faPlay} className="checkbox-icon" />
              Start sprint immediately
            </label>
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

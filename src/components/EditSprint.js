import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchSprintById, editSprint } from "../services/sprintService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCalendarAlt, faPlay, faCheck, faSave } from "@fortawesome/free-solid-svg-icons";
import "../styles/create_sprint.css";
/**
 * EditSprint Component
 * 
 * Allows users to modify sprint metadata, including name, start/end dates, and status.
 * Supports lifecycle transitions such as starting or completing a sprint.
 * 
 * @returns {JSX.Element} Editable form for a single sprint
 * 
 * @param {string} sprintId - Sprint identifier retrieved from route parameters
 * 
 * @state sprintName - Current name of the sprint
 * @state startDate - Start date in ISO format (YYYY-MM-DD)
 * @state endDate - End date in ISO format (YYYY-MM-DD)
 * @state isStarted - Boolean indicating if the sprint has started
 * @state isCompleted - Boolean indicating if the sprint is completed
 * @state projectID - Associated project identifier
 * @state error - Message shown when operations fail
 * @state success - Message shown after successful operations
 * @state loading - Flag indicating loading state during data fetch
 * @state formModified - Tracks whether changes have been made to the form
 * 
 * @method handleUpdateSprint - Submits updated sprint details
 * @method handleStartSprint - Transitions the sprint to "started" state
 * @method handleCompleteSprint - Marks the sprint as complete and redirects to backlog
 * @method useEffect - Loads sprint data on component mount
 * @method getStatusText - Returns current sprint status as a user-friendly string
 */
const EditSprint = () => {
  const navigate = useNavigate();
  const { sprintId } = useParams();

  const [sprintName, setSprintName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [projectID, setProjectID] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(null);
  const [formModified, setFormModified] = useState(false);

  useEffect(() => {
    const loadSprintDetails = async () => {
      try {
        const sprintData = await fetchSprintById(sprintId);
        setSprintName(sprintData.name);
        setStartDate(sprintData.startDate.split("T")[0]);
        setEndDate(sprintData.endDate.split("T")[0]);
        setIsStarted(sprintData.isStarted || false);
        setIsCompleted(sprintData.isCompleted || false);
        setProjectID(sprintData.projectID);
      } catch (err) {
        setError("Failed to load sprint details.");
      } finally {
        setLoading(false);
      }
    };

    loadSprintDetails();
  }, [sprintId]);

  // Track form changes
  const handleNameChange = (e) => {
    setSprintName(e.target.value);
    setFormModified(true);
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    setFormModified(true);
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
    setFormModified(true);
  };

  const handleUpdateSprint = async () => {
    if (!sprintName || !startDate || !endDate || !projectID) {
      setError("All fields are required.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      const updatedSprintData = {
        id: sprintId,
        name: sprintName,
        startDate,
        endDate,
        isStarted,
        isCompleted,
        projectID,
      };

      await editSprint(updatedSprintData);
      setSuccess("Details updated successfully!");
      setFormModified(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Failed to update sprint details.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleStartSprint = async () => {
    try {
      const updatedSprintData = {
        id: sprintId,
        name: sprintName,
        startDate,
        endDate,
        isStarted: true,
        isCompleted: false,
        projectID,
      };

      await editSprint(updatedSprintData);
      setIsStarted(true);
      setIsCompleted(false);
      setFormModified(false);
      setSuccess("Sprint started successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Failed to start sprint.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleCompleteSprint = async () => {
    try {
      const updatedSprintData = {
        id: sprintId,
        name: sprintName,
        startDate,
        endDate,
        isStarted: false,
        isCompleted: true,
        projectID,
      };

      await editSprint(updatedSprintData);
      setIsStarted(false);
      setIsCompleted(true);
      setFormModified(false);
      setSuccess("Sprint completed successfully!");
      setTimeout(() => {
        navigate("/backlog");
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to complete sprint.");
      setTimeout(() => setError(null), 3000);
    }
  };

  // Get the current sprint status text
  const getStatusText = () => {
    if (isCompleted) return "Completed";
    if (isStarted) return "In Progress";
    return "Not Started";
  };

  return (
    <div className="create-sprint-page">
      <div className="create-sprint-container">
        <div className="card">
          <div className="back-arrow" onClick={() => navigate("/backlog")}>
            <FontAwesomeIcon icon={faArrowRotateLeft} />
          </div>

          <h2>Edit Sprint</h2>

          {loading ? (
            <p className="loading-message">Loading sprint details...</p>
          ) : (
            <>
              <input
                type="text"
                placeholder="Enter Sprint Name"
                value={sprintName}
                onChange={handleNameChange}
                disabled={isCompleted}
              />

              <div className="input-group">
                <label>
                  <FontAwesomeIcon icon={faCalendarAlt} className="calendar-icon" /> Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  disabled={isStarted || isCompleted}
                />
              </div>

              <div className="input-group">
                <label>
                  <FontAwesomeIcon icon={faCalendarAlt} className="calendar-icon" /> End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  min={startDate}
                  disabled={isCompleted}
                />
              </div>

              <div className="sprint-status">
                <div className="status-indicator">
                  Status: {getStatusText()}
                </div>
              </div>

              <div className="button-group">
                {/* Only show save changes button if form was modified */}
                {formModified && (
                  <button
                    className="button-primary"
                    onClick={handleUpdateSprint}
                    disabled={isCompleted}
                  >
                    <FontAwesomeIcon icon={faSave} className="button-icon" />
                    Save Changes
                  </button>
                )}

                {/* Status change buttons */}
                {!isStarted && !isCompleted && (
                  <button
                    className="button-success"
                    onClick={handleStartSprint}
                  >
                    <FontAwesomeIcon icon={faPlay} className="button-icon" />
                    Start Sprint
                  </button>
                )}

                {/* Show Complete button if not completed */}
                {!isCompleted && (
                  <button
                    className="button-danger"
                    onClick={handleCompleteSprint}
                  >
                    <FontAwesomeIcon icon={faCheck} className="button-icon" />
                    Complete Sprint
                  </button>
                )}
              </div>
            </>
          )}

          {error && <div className="error-popup">{error}</div>}
          {success && <div className="success-popup">{success}</div>}
        </div>
      </div>
    </div>
  );
};

export default EditSprint;

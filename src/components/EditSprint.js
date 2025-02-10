import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchSprintById, editSprint } from "../services/projectService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import "../styles/create_sprint.css"; // Reuse styles from create sprint

const EditSprint = () => {
  const navigate = useNavigate();
  const { sprintId } = useParams(); // Get sprint ID from URL params

  const [sprintName, setSprintName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectID, setProjectID] = useState(""); // Store project ID
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSprintDetails = async () => {
      try {
        const sprintData = await fetchSprintById(sprintId);
        setSprintName(sprintData.name);
        setStartDate(sprintData.startDate.split("T")[0]); // Extract date part
        setEndDate(sprintData.endDate.split("T")[0]);
        setProjectID(sprintData.projectID); // Ensure projectID is set
      } catch (err) {
        setError("Failed to load sprint details.");
      } finally {
        setLoading(false);
      }
    };

    loadSprintDetails();
  }, [sprintId]);

  const handleUpdateSprint = async () => {
    if (!sprintName || !startDate || !endDate || !projectID) {
      setError("All fields are required.");
      setTimeout(() => setError(null), 2000);
      return;
    }

    try {
      const updatedSprintData = {
        id: sprintId, // Required for updating
        name: sprintName,
        startDate,
        endDate,
        projectID, // Include projectID in update request
      };

      await editSprint(updatedSprintData);

      // Redirect to Backlog
      navigate("/backlog");
    } catch (err) {
      setError(err.message || "Failed to update sprint.");
      setTimeout(() => setError(null), 2000);
    }
  };

  return (
    <div className="create-sprint-page">
      <div className="create-sprint-container">
        <div className="card">
          {/* Back Arrow (Same as Create Sprint Page) */}
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

              <button className="button-primary" onClick={handleUpdateSprint}>
                Update Sprint
              </button>
            </>
          )}

          {error && <div className="error-popup">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default EditSprint;

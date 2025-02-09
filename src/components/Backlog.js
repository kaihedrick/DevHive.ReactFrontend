import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchProjectTasks, fetchProjectSprints, getSelectedProject } from "../services/projectService";
import useBacklogActions from "../hooks/useBacklogActions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import "../styles/backlog.css";

const Backlog = ({ projectId }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const selectedProjectId = projectId || getSelectedProject();

  useEffect(() => {
    console.log("🔍 Using Project ID:", selectedProjectId);

    if (!selectedProjectId) {
      console.error("❌ No Project ID found.");
      setError("No Project ID found. Please select a project.");
      setLoading(false);
      return;
    }

    const loadSprints = async () => {
      try {
        setLoading(true);
        console.log("🔄 Fetching sprints...");
        const fetchedSprints = await fetchProjectSprints(selectedProjectId);
        console.log("✅ Retrieved Sprints:", fetchedSprints);
        setSprints(fetchedSprints || []);
      } catch (err) {
        setError(err.message || "An error occurred while fetching sprints.");
      } finally {
        setLoading(false);
      }
    };

    loadSprints();
  }, [selectedProjectId]);

  const handleSprintClick = async (sprint) => {
    setSelectedSprint(sprint);
    setLoading(true);
    try {
      console.log(`🔄 Fetching tasks for Sprint: ${sprint.name}`);
      const fetchedTasks = await fetchProjectTasks(selectedProjectId);
      const sprintTasks = fetchedTasks.filter(task => task.sprintID === sprint.id);
      setTasks(sprintTasks);
      console.log("✅ Tasks for Sprint:", sprintTasks);
    } catch (err) {
      setError("Failed to fetch sprint tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sprintName = params.get("success");

    if (sprintName) {
      setSuccessMessage(`Sprint "${sprintName}" was successfully created!`);

      setTimeout(() => setSuccessMessage(null), 3000);
    }
  }, [location.search]);

  const handleGoBack = () => {
    setSelectedSprint(null);
  };

  return (
    <div className="backlog-page">
      {/* ✅ Back Arrow (Outside Backlog Container) */}
      <div className="back-arrow" onClick={() => navigate("/projects")}>
        <FontAwesomeIcon icon={faArrowRotateLeft} />
      </div>

      <div className="backlog-container">
        {successMessage && <div className="success-popup">✅ {successMessage}</div>}

        <h2 className="backlog-header">Backlog</h2>

        {loading ? (
          <p className="loading-message">Loading backlog...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : selectedSprint ? (
          <div className="sprint-details-container">
            {/* ✅ Back Arrow inside Sprint View */}
            <div className="back-arrow sprint-view" onClick={handleGoBack}>
              <FontAwesomeIcon icon={faArrowRotateLeft} />
            </div>

            <h3>{selectedSprint.name}</h3>
            <p>Duration: {new Date(selectedSprint.startDate).toLocaleDateString()} - {new Date(selectedSprint.endDate).toLocaleDateString()}</p>
            <p>Started: <FontAwesomeIcon icon={selectedSprint.isStarted ? faCheck : faXmark} className={`sprint-status-icon ${selectedSprint.isStarted ? "completed" : "not-started"}`} /></p>
            <p>Completed: <FontAwesomeIcon icon={selectedSprint.isCompleted ? faCheck : faXmark} className={`sprint-status-icon ${selectedSprint.isCompleted ? "completed" : "not-started"}`} /></p>

            <div className="task-list">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <div key={task.id} className="task-card">
                    <div className="task-title">{task.description}</div>
                    <div className="task-details">
                      <span className="task-assignee">{task.assigneeID}</span>
                      <span className="task-date">{new Date(task.dateCreated).toLocaleDateString()}</span>
                      <span className={`task-status ${task.status === 0 ? "todo" : task.status === 1 ? "in-progress" : "completed"}`}>
                        {task.status === 0 ? "To Do" : task.status === 1 ? "In Progress" : "Completed"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-tasks-message">No tasks in this sprint.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="sprint-overview-container">
            {sprints.length > 0 ? (
              sprints.map((sprint) => (
                <div key={sprint.id} className="sprint-card" onClick={() => handleSprintClick(sprint)}>
                  <h3>{sprint.name}</h3>
                  <p>Duration: {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}</p>
                  <p>Started: <FontAwesomeIcon icon={sprint.isStarted ? faCheck : faXmark} className={`sprint-status-icon ${sprint.isStarted ? "completed" : "not-started"}`} /></p>
                  <p>Completed: <FontAwesomeIcon icon={sprint.isCompleted ? faCheck : faXmark} className={`sprint-status-icon ${sprint.isCompleted ? "completed" : "not-started"}`} /></p>
                </div>
              ))
            ) : (
              <p className="no-sprints-message">No sprints available.</p>
            )}
          </div>
        )}

        <div className="backlog-actions">
          <button className="button button-primary" onClick={useBacklogActions().handleCreateSprint}>
            Create Sprint
          </button>
        </div>
      </div>
    </div>
  );
};

export default Backlog;

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchProjectTasksWithAssignees, fetchProjectSprints, fetchProjectMembers, fetchTaskById, getSelectedProject } from "../services/projectService";
import useBacklogActions from "../hooks/useBacklogActions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCheck, faXmark, faPenToSquare } from "@fortawesome/free-solid-svg-icons";
import "../styles/backlog.css";

const Backlog = ({ projectId }) => {
  const navigate = useNavigate();
  const location = useLocation(); // Get current path
  
  const { handleUpdateTaskStatus, handleUpdateTaskAssignee } = useBacklogActions();

  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const selectedProjectId = projectId || getSelectedProject();

  useEffect(() => {
    if (!selectedProjectId) {
      setError("No Project ID found. Please select a project.");
      setLoading(false);
      return;
    }

    const loadSprintsAndMembers = async () => {
      try {
        setLoading(true);
        const fetchedSprints = await fetchProjectSprints(selectedProjectId);
        const fetchedMembers = await fetchProjectMembers(selectedProjectId);
        setSprints(fetchedSprints || []);
        setMembers(fetchedMembers || []);
      } catch (err) {
        setError(err.message || "An error occurred while fetching data.");
      } finally {
        setLoading(false);
      }
    };

    loadSprintsAndMembers();
  }, [selectedProjectId]);
  

  const handleSprintClick = async (sprint) => {
    setSelectedSprint(sprint);
    setLoading(true);
    try {
      const fetchedTasks = await fetchProjectTasksWithAssignees(selectedProjectId);
      const sprintTasks = fetchedTasks.filter(task => task.sprintID === sprint.id);
      setTasks(sprintTasks);
    } catch (err) {
      setError("Failed to fetch sprint tasks.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    setSelectedSprint(null);
  };

  /** ✅ Fetch updated task after change */
  const refreshTask = async (taskId) => {
    try {
      const updatedTask = await fetchTaskById(taskId);
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === taskId ? updatedTask : task))
      );
    } catch (error) {
      console.error("❌ Error fetching updated task:", error);
    }
  };

  /** ✅ Handle Status Change */
  const handleStatusChange = async (task, newStatus) => {
    try {
      await handleUpdateTaskStatus(task, newStatus);
      refreshTask(task.id);
    } catch (error) {
      console.error("❌ Error updating task status:", error);
    }
  };

  /** ✅ Handle Assignee Change */
  const handleAssigneeChange = async (task, newAssigneeId) => {
    try {
      await handleUpdateTaskAssignee(task, newAssigneeId);
      refreshTask(task.id);
    } catch (error) {
      console.error("❌ Error updating assignee:", error);
    }
  };

  return (
    <div className="backlog-page">
      <div className="backlog-container">
        <h2 className="backlog-header">Backlog</h2>

        {loading ? (
          <p className="loading-message">Loading backlog...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : selectedSprint ? (
          <div className="sprint-details-container">
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
                  <div key={task.id} className={`task-card ${task.status === 0 ? "todo" : task.status === 1 ? "in-progress" : "completed"}`}>
                    <FontAwesomeIcon 
                      icon={faPenToSquare} 
                      className="edit-task-icon" 
                      onClick={(e) => { 
                        e.stopPropagation();
                        navigate(`/edit-task/${task.id}`, { 
                          state: { 
                            from: location.pathname, 
                            sprint: selectedSprint // Pass selected sprint data 
                          } 
                        }); 
                      }} 
                    />
                    <div className="task-content">
                      <span className="task-title">{task.description}</span>
                    </div>
                    <div className="task-details">
                      <select className="task-assignee-dropdown" value={task.assigneeID} onChange={(e) => handleAssigneeChange(task, e.target.value)}>
                        {members.map(member => (
                          <option key={member.id} value={member.id}>
                            {member.firstName[0]}{member.lastName[0]}
                          </option>
                        ))}
                      </select>
                      <span className="task-date">Date: {new Date(task.dateCreated).toLocaleDateString()}</span>
                      <select 
                        className={`task-status ${task.status === 0 ? "todo" : task.status === 1 ? "in-progress" : "completed"}`} 
                        value={task.status} 
                        onChange={(e) => handleStatusChange(task, e.target.value)}
                      >
                        <option value="0">To Do</option>
                        <option value="1">In Progress</option>
                        <option value="3">Completed</option>
                      </select>
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
                  <div className="edit-sprint-button" onClick={(e) => { e.stopPropagation(); navigate(`/edit-sprint/${sprint.id}`); }}>
                    <FontAwesomeIcon icon={faPenToSquare} />
                  </div>
                  <h3>{sprint.name}</h3>
                  <p>Duration: {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}</p>
                </div>
              ))
            ) : (
              <p className="no-sprints-message">No sprints available.</p>
            )}
          </div>
        )}
      </div>
      
      {/*  Create Sprint / Task Button */}
      <div className="create-sprint-button-container">
        {selectedSprint ? (
          <button 
            className="create-task-button" 
            onClick={() => navigate(`/create-task?sprintId=${selectedSprint.id}`)}
          >
            Create Task
          </button>
        ) : (
          <button 
            className="create-sprint-button" 
            onClick={() => navigate("/create-sprint")}
          >
            Create Sprint
          </button>
        )}
      </div>


    </div>
  );
};

export default Backlog;

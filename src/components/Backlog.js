import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchProjectMembers } from "../services/projectService";
import { fetchProjectSprints } from "../services/sprintService";
import { fetchSprintTasks, fetchTaskById, editTask } from "../services/taskService";
import { getSelectedProject } from "../services/storageService";
import useBacklogActions from "../hooks/useBacklogActions";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCheck, faXmark, faPenToSquare, faPlus, faTimes, faExclamationTriangle, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import "../styles/backlog.css";
/**
 * Backlog Component
 *
 * Displays sprint overviews and allows viewing and managing tasks within a selected sprint.
 * Supports task status updates, inline editing, assignee assignment, and sprint navigation.
 *
 * @prop {string} projectId - Optional project ID, falls back to localStorage if not provided.
 *
 * @state sprints - List of project sprints
 * @state selectedSprint - Currently viewed sprint
 * @state tasks - Tasks in the selected sprint
 * @state members - Project members
 * @state loading - Controls loading UI state
 * @state error - Stores and displays error messages
 * @state successMessage - Stores and displays success messages
 * @state isEditingTask - Task ID currently being edited
 * @state editedDescription - Local state for task description edit form
 *
 * @hook useEffect - Loads sprints and members when projectId is available
 * @hook useEffect - Filters tasks by selected sprint
 * @hook useBacklogActions - Custom hook for updating task status
 *
 * @function handleSprintClick - Loads and filters sprint tasks
 * @function handleStatusChange - Updates task status and reflects it in UI
 * @function handleAssigneeChange - Updates task assignee
 * @function handleEditTask - Loads task data for editing
 * @function handleSaveEdit - Submits and saves updated task
 * @function handleCancelEdit - Exits task edit mode
 *
 * @componentCondition - Conditionally renders:
 *   - Sprint overview if no sprint is selected
 *   - Task list if a sprint is selected
 *   - Error/success/loading messages
 *
 * @accessibility - Icons include labels, inputs use associated labels
 */

const Backlog = ({ projectId }) => {
  const navigate = useNavigate();
  const location = useLocation(); // Get current path
  
  const { handleUpdateTaskStatus } = useBacklogActions();

  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isEditingTask, setIsEditingTask] = useState(null); // Track which task is being edited
  const [editedDescription, setEditedDescription] = useState(""); // Track the edited description
  
  // Auto-resize textarea for task description editing
  const descriptionTextareaRef = useAutoResizeTextarea(editedDescription, 1);

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
      const sprintTasks = await fetchSprintTasks(sprint.id);
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
      console.log(`🔄 Updating status for Task ID: ${task.id} to ${newStatus}`);
      await handleUpdateTaskStatus(task, newStatus);
      refreshTask(task.id);
      
      // Add success message
      const statusText = newStatus === 0 ? 'To Do' : newStatus === 1 ? 'In Progress' : 'Completed';
      setSuccessMessage(`Task moved to ${statusText}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("❌ Error updating task status:", error);
      setError(`Failed to update task status: ${error.message}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  /** ✅ Handle Assignee Change */
  const handleAssigneeChange = async (task, newAssigneeId) => {
    try {
      // Convert "Unassigned" to null
      const updatedAssigneeId = newAssigneeId === "unassigned" ? null : newAssigneeId;

      // Create a task object with only updatable fields
      const updatedTask = {
        id: task.id,
        description: task.description,
        assigneeId: updatedAssigneeId, // Set to null if unassigned
      };

      console.log("Updating task with new assignee:", updatedTask);

      // Update the task in the backend
      await editTask(updatedTask);

      // Update the task in the state
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === task.id ? { ...t, assigneeId: updatedAssigneeId } : t
        )
      );

      // Show success message
      setSuccessMessage("Task assignee updated");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error updating task assignee:", err);
      setError(`Failed to update task assignee: ${err.message}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleEditTask = async (taskId) => {
    try {
      const taskData = await fetchTaskById(taskId); // Fetch task details
      setIsEditingTask(taskId); // Set the task being edited
      setEditedDescription(taskData.description); // Pre-fill the description
    } catch (error) {
      console.error("❌ Error fetching task details:", error.message);
      alert("Failed to load task details. Please try again.");
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTask(null); // Exit edit mode
    setEditedDescription(""); // Clear the description
  };

  const handleSaveEdit = async (task) => {
    if (!editedDescription.trim()) {
      alert("Task description cannot be empty.");
      return;
    }
  
    try {
      // Create a task object with only updatable fields
      const updatedTask = {
        id: task.id,
        description: editedDescription, // Updated description
        assigneeId: task.assigneeId || null, // Assignee ID (or null if unassigned)
      };
  
      console.log("Updated Task:", updatedTask); // Debugging: Log the task being sent
  
      await editTask(updatedTask); // Call the API to save the task
      setIsEditingTask(null); // Exit edit mode
      refreshTask(task.id); // Refresh the task to reflect changes
    } catch (error) {
      console.error("❌ Error saving task:", error.message);
      alert("Failed to save task. Please try again.");
    }
  };
  // Sort sprints by start date (earliest first)
  const sortedSprints = [...sprints].sort((a, b) => 
    new Date(a.startDate) - new Date(b.startDate)
  );

  // Find next sprint to start (not started and earliest date)
  const nextSprintToStart = sortedSprints.find(sprint => 
    !sprint.isStarted && new Date(sprint.startDate) >= new Date()
  );

  return (
    <div className="backlog-page">
      <div className="backlog-container">
        <h2 className="backlog-header">Backlog</h2>

        {loading ? (
          <div className="alert warning">
            <FontAwesomeIcon icon={faExclamationTriangle} className="alert-icon" />
            Loading backlog...
          </div>
        ) : error ? (
          <div className="alert error">
            <FontAwesomeIcon icon={faExclamationCircle} className="alert-icon" />
            {error}
          </div>
        ) : successMessage ? (
          <div className="alert success">
            <FontAwesomeIcon icon={faCheck} className="alert-icon" />
            {successMessage}
          </div>
        ) : null}

        {selectedSprint ? (
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
                    {isEditingTask === task.id ? (
                      <>
                        {/* Edit Mode */}
                        <div className="task-content">
                          <textarea
                            ref={descriptionTextareaRef}
                            className="edit-description"
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            maxLength={255}
                            placeholder="Edit task description"
                            style={{ resize: 'none', overflow: 'hidden' }}
                          />
                          <span className="char-counter">{editedDescription.length} / 255</span>
                        </div>
                        <div className="task-controls edit-mode">
                          <button className="save-btn" onClick={() => handleSaveEdit(task)}>
                            <FontAwesomeIcon icon={faCheck} />
                          </button>
                          <button className="cancel-btn" onClick={handleCancelEdit}>
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* View Mode */}
                        <div className="task-content">
                          <span className="task-title">{task.description}</span>
                        </div>
                        <div className="task-controls">
                          <FontAwesomeIcon
                            icon={faPenToSquare}
                            className="edit-task-icon"
                            onClick={() => handleEditTask(task.id)}
                          />
                          <select
                            className={`task-status ${
                              task.status === 0
                                ? "todo"
                                : task.status === 1
                                ? "in-progress"
                                : "completed"
                            }`}
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, parseInt(e.target.value))}
                          >
                            <option value="0">To Do</option>
                            <option value="1">In Progress</option>
                            <option value="2">Completed</option>
                          </select>
                          <select
                            className="task-assignee-dropdown"
                            value={task.assigneeId || "unassigned"}
                            onChange={(e) => handleAssigneeChange(task, e.target.value)}
                          >
                            <option value="unassigned">Unassigned</option>
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.firstName} {member.lastName}
                              </option>
                            ))}
                          </select>
                          <span className="task-date">
                            Date: {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {/* Task Alert */}
                        {task.alert && (
                          <div className={`task-alert ${task.alert.type}`}>
                            {task.alert.message}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="alert warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="alert-icon" />
                  No tasks in this sprint.
                </div>
              )}
            </div>
            
            {/* Action button container - INSIDE container */}
            <div className="action-button-container">
              <button 
                className="create-task-button" 
                onClick={() => navigate(`/create-task?sprintId=${selectedSprint.id}`)}
              >
                <FontAwesomeIcon icon={faPlus} className="button-icon" /> Create Task
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="sprint-overview-container">
              {sortedSprints.length > 0 ? (
                sortedSprints.map((sprint) => (
                  <div key={sprint.id} className="sprint-card" onClick={() => handleSprintClick(sprint)}>
                    <div className="edit-sprint-button" onClick={(e) => { e.stopPropagation(); navigate(`/edit-sprint/${sprint.id}`); }}>
                      <FontAwesomeIcon icon={faPenToSquare} />
                    </div>
                    <h3>{sprint.name}</h3>
                    <p>Duration: {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}</p>
                    <div className="sprint-status">
                      {sprint.isCompleted ? (
                        <span className="status-completed">Completed</span>
                      ) : sprint.isStarted ? (
                        <span className="status-started">In Progress</span>
                      ) : (
                        <span className="status-not-started">Not Started</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="alert warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="alert-icon" />
                  No sprints available.
                </div>
              )}
            </div>
            
            {/* Action button container - INSIDE container */}
            <div className="action-button-container">
              <button 
                className="create-sprint-button" 
                onClick={() => navigate("/create-sprint")}
              >
                <FontAwesomeIcon icon={faPlus} className="button-icon" /> Create Sprint
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Backlog;

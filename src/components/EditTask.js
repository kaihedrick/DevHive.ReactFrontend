import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { fetchTaskById, editTask, fetchProjectMembers, fetchProjectSprints, getSelectedProject } from "../services/projectService";
import "../styles/create_task.css"; // Reuse styles from create task
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
/**
 * EditTask Component
 * 
 * Renders a form to edit a task's description, assignee, and sprint.
 * Retrieves the task details, members, and sprints associated with the project.
 * 
 * @returns {JSX.Element} Edit Task form interface
 * 
 * @param {string} taskId - Task ID from route params
 * @param {string} previousPage - Fallback navigation target
 * @param {string|null} sprint - Sprint ID passed from previous navigation state
 * 
 * @state description - Task description
 * @state assigneeID - Selected assignee user ID
 * @state sprintID - Selected sprint ID
 * @state members - List of project members
 * @state sprints - List of project sprints
 * @state errorMessage - User-facing error message
 * @state loading - Flag to control initial loading state
 * 
 * @method handleUpdateTask - Submits the updated task fields to the server
 * @method useEffect - Loads task data, members, and sprints on mount
 */
const EditTask = () => {
  const navigate = useNavigate();
  const { taskId } = useParams(); // Get task ID from URL params
  const location = useLocation(); // Get previous page info
  
  // Get the previous page & sprint
  const previousPage = location.state?.from || "/backlog";
  const sprint = location.state?.sprint || null; // Get sprint if available


  const [description, setDescription] = useState("");
  const [assigneeID, setAssigneeID] = useState("");
  const [sprintID, setSprintID] = useState("");
  const [members, setMembers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Get Project ID (from props or localStorage)
  const selectedProjectId = getSelectedProject();

  useEffect(() => {
    if (!selectedProjectId) {
      setErrorMessage("No Project ID found. Please select a project.");
      setLoading(false);
      return;
    }

    const loadTaskDetails = async () => {
      try {
        // Fetch task details
        const taskData = await fetchTaskById(taskId);
        setDescription(taskData.description);
        setAssigneeID(taskData.assigneeID);
        setSprintID(taskData.sprintID);

        // Fetch project members
        const projectMembers = await fetchProjectMembers(selectedProjectId);
        setMembers(projectMembers || []);

        // Fetch sprints
        const projectSprints = await fetchProjectSprints(selectedProjectId);
        setSprints(projectSprints || []);
      } catch (error) {
        setErrorMessage("Failed to load task details.");
      } finally {
        setLoading(false);
      }
    };

    loadTaskDetails();
  }, [taskId, selectedProjectId]);

  const handleUpdateTask = async () => {
    if (!description || !assigneeID || !sprintID) {
      setErrorMessage("All fields are required!");
      setTimeout(() => setErrorMessage(""), 2000);
      return;
    }

    try {
      const updatedTaskData = {
        id: taskId, // Required for updating
        description,
        assigneeID,
        sprintID,
      };

      await editTask(updatedTaskData);

      // Redirect back to previous page
      navigate(previousPage);
    } catch (error) {
      console.error("❌ Error updating task:", error);
      setErrorMessage("Task update failed.");
      setTimeout(() => setErrorMessage(""), 2000);
    }
  };

  return (
    <div className="create-task-container">
        
      {errorMessage && <div className="error-popup">{errorMessage}</div>}

      <div className="create-task-card">
         {/* Back Arrow (Goes back to previous page) */}
         <div className="back-arrow" onClick={() => {
          if (sprint) {
            navigate(previousPage, { state: { sprint } });
          } else {
            navigate(previousPage);
          }
        }}>
          <FontAwesomeIcon icon={faArrowRotateLeft} />
        </div>

        <h2>Edit Task</h2>

        {loading ? (
          <p className="loading-message">Loading task details...</p>
        ) : (
          <>
            <input
              type="text"
              placeholder="Enter Task Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <label>Assignee:</label>
            <select value={assigneeID} onChange={(e) => setAssigneeID(e.target.value)}>
              <option value="">Select Assignee</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>

            <label>Sprint:</label>
            <select value={sprintID} onChange={(e) => setSprintID(e.target.value)}>
              <option value="">Select Sprint</option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
              ))}
            </select>

            <button className="create-task-btn" onClick={handleUpdateTask}>
              Update Task
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EditTask;

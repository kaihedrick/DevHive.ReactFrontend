import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSelectedProject } from "../services/projectService";
import { fetchProjectMembers } from "../services/projectService";
import { useSprintManagement } from "../hooks/useSprintManagement";
import { useTaskManagement } from "../hooks/useTaskManagement";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faExclamationTriangle, faSpinner } from "@fortawesome/free-solid-svg-icons";
import "../styles/create_task.css";
/**
 * CreateTask Component
 * 
 * Allows users to create a new task within the selected project and sprint.
 * 
 * @returns {JSX.Element} Form UI for creating a task
 * 
 * @param {string} selectedProjectId - Project ID retrieved from local storage
 * 
 * @state description - Task description input field
 * @state assigneeID - Selected assignee's user ID
 * @state sprintID - Selected sprint ID (may be prefilled from query param)
 * @state members - List of available project members for selection
 * @state errorMessage - UI error messaging shown to the user
 * @state isSubmitting - Flag for disabling form during submission
 * @state membersLoading - Indicates members are being fetched
 * 
 * @hook useSprintManagement - Fetches sprints and sprint-related state from backend
 * @hook useTaskManagement - Provides task creation logic and task-related error handling
 * 
 * @method handleCreateTaskSubmit - Validates and submits the task creation request
 * @method handleKeyDown - Allows form submission via Enter key
 * 
 * @effect Loads project members when component mounts or selectedProjectId changes
 * @effect Handles sprint/task hook-level errors and sets error state
 */
const CreateTask = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get query parameters (for preselected sprint)
  const queryParams = new URLSearchParams(location.search);
  const preselectedSprintId = queryParams.get('sprintId');
  
  // Form state
  const [description, setDescription] = useState("");
  const [assigneeID, setAssigneeID] = useState("");
  const [sprintID, setSprintID] = useState(preselectedSprintId || "");
  const [members, setMembers] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);

  // Get the selected project ID
  const selectedProjectId = getSelectedProject();
  
  // Initialize hooks
  const { 
    sprints, 
    loading: sprintsLoading, 
    error: sprintError 
  } = useSprintManagement(selectedProjectId);
  
  const { 
    handleCreateTask, 
    error: taskError
  } = useTaskManagement(selectedProjectId);
  
  // Handle and display errors from hooks
  useEffect(() => {
    if (sprintError) {
      setErrorMessage(`Sprint error: ${sprintError}`);
      setTimeout(() => setErrorMessage(""), 3000);
    }
  }, [sprintError]);
  
  useEffect(() => {
    if (taskError) {
      setErrorMessage(`Task error: ${taskError}`);
      setTimeout(() => setErrorMessage(""), 3000);
    }
  }, [taskError]);
  
  // Fetch project members
  useEffect(() => {
    if (!selectedProjectId) {
      setErrorMessage("No Project ID found. Please select a project.");
      return;
    }

    const loadMembers = async () => {
      try {
        setMembersLoading(true);
        console.log("🔄 Fetching project members...");
        const projectMembers = await fetchProjectMembers(selectedProjectId);
        console.log("✅ Members Loaded:", projectMembers);
        
        setMembers(projectMembers || []);
        setErrorMessage("");
      } catch (error) {
        console.error("❌ Error loading project members:", error);
        setErrorMessage(`Failed to load project members: ${error.message || "Unknown error"}`);
      } finally {
        setMembersLoading(false);
      }
    };

    loadMembers();
  }, [selectedProjectId]);

  const handleCreateTaskSubmit = async () => {
    // Check if all required fields are filled
    if (!description || !assigneeID || !sprintID) {
      setErrorMessage("All fields are required.");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const taskData = {
        description,
        assigneeID,
        sprintID,
        projectID: selectedProjectId
      };
      
      const result = await handleCreateTask(taskData);
      
      if (result.success) {
        // Show success message and redirect
        console.log("✅ Task created successfully!");
        
        // Redirect to backlog with success indicator (similar to CreateSprint)
        navigate(`/backlog?taskCreated=${encodeURIComponent(description.substring(0, 15))}`);
      } else {
        // Display error from result
        setErrorMessage(result.error || "Task creation failed");
        setTimeout(() => setErrorMessage(""), 3000);
      }
    } catch (error) {
      console.error("❌ Error in task creation:", error);
      setErrorMessage(error.message || "An unexpected error occurred");
      setTimeout(() => setErrorMessage(""), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to handle form submission via Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleCreateTaskSubmit();
    }
  };

  if (!selectedProjectId) {
    return (
      <div className="create-task-container">
        <div className="create-task-card">
          <div className="back-arrow" onClick={() => navigate("/backlog")}>
            <FontAwesomeIcon icon={faArrowRotateLeft} />
          </div>
          <h2>Error</h2>
          <p>No project selected. Please select a project first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="create-task-container">
      {errorMessage && (
        <div className="error-popup">
          <FontAwesomeIcon icon={faExclamationTriangle} className="error-icon" />
          {errorMessage}
        </div>
      )}

      <div className="create-task-card">
        {/* Back Arrow */}
        <div className="back-arrow" onClick={() => navigate("/backlog")}>
          <FontAwesomeIcon icon={faArrowRotateLeft} />
        </div>
        
        <h2>Create Task</h2>

        <div className="form-group">
          <label htmlFor="task-description">Description:</label>
          <input
            id="task-description"
            type="text"
            placeholder="Enter Task Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="task-assignee">Assignee:</label>
          {membersLoading ? (
            <div className="select-loading">
              <FontAwesomeIcon icon={faSpinner} spin /> Loading members...
            </div>
          ) : (
            <select 
              id="task-assignee"
              value={assigneeID} 
              onChange={(e) => setAssigneeID(e.target.value)}
              disabled={members.length === 0 || isSubmitting}
            >
              <option value="">Select Assignee</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
          )}
          {members.length === 0 && !membersLoading && (
            <div className="helper-text">No team members available for this project</div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="task-sprint">Sprint:</label>
          {sprintsLoading ? (
            <div className="select-loading">
              <FontAwesomeIcon icon={faSpinner} spin /> Loading sprints...
            </div>
          ) : (
            <select 
              id="task-sprint"
              value={sprintID} 
              onChange={(e) => setSprintID(e.target.value)}
              disabled={sprintsLoading || sprints.length === 0 || isSubmitting}
            >
              <option value="">Select Sprint</option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </option>
              ))}
            </select>
          )}
          {sprints.length === 0 && !sprintsLoading && (
            <div className="helper-text">No sprints available for this project</div>
          )}
        </div>

        <button 
          className="create-task-btn" 
          onClick={handleCreateTaskSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin /> Creating...
            </>
          ) : (
            "Create Task"
          )}
        </button>
      </div>
    </div>
  );
};

export default CreateTask;

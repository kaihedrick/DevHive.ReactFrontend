import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSelectedProject } from "../services/storageService";
import { useProjectMembers } from "../hooks/useProjects.ts";
import { useSprintManagement } from "../hooks/useSprintManagement.ts";
import { useTaskManagement } from "../hooks/useTaskManagement.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faExclamationTriangle, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { User, Sprint } from "../types/hooks.ts";
import { useScrollIndicators } from "../hooks/useScrollIndicators.ts";
import { useToast } from "../contexts/ToastContext.tsx";
import "../styles/create_task.css";
import "../styles/create_sprint.css"; // Import shared form styles

/**
 * CreateTask Component
 * 
 * Allows users to create a new task within the selected project and sprint.
 * 
 * @returns {JSX.Element} Form UI for creating a task
 */
const CreateTask: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showSuccess } = useToast();
  
  // Get query parameters (for preselected sprint and project)
  const queryParams = new URLSearchParams(location.search);
  const preselectedSprintId = queryParams.get('sprintId');
  const urlProjectId = queryParams.get('projectId');
  
  // Form state
  const [description, setDescription] = useState<string>("");
  const [assigneeID, setAssigneeID] = useState<string>("");
  const [sprintID, setSprintID] = useState<string>(preselectedSprintId || "");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Progressive Disclosure + Affordance scroll indicators
  const containerRef = useScrollIndicators([description, sprintID, assigneeID]);

  // Get the selected project ID (prioritize URL parameter over stored project)
  const selectedProjectId = urlProjectId || getSelectedProject();
  
  // Initialize hooks first (before any conditional returns)
  const { 
    sprints, 
    loading: sprintsLoading, 
    error: sprintError 
  } = useSprintManagement(selectedProjectId || '');
  
  const { 
    handleCreateTask, 
    error: taskError
  } = useTaskManagement(selectedProjectId || '');
  
  // Use TanStack Query hook for project members
  const { data: membersData, isLoading: membersLoading, error: membersError } = useProjectMembers(selectedProjectId);
  
  // Extract members array from response
  const members: User[] = useMemo(() => {
    if (!membersData) return [];
    return membersData.members || membersData || [];
  }, [membersData]);
  
  // Handle and display errors from hooks
  useEffect(() => {
    if (sprintError) {
      showError(`Sprint error: ${sprintError}`);
    }
  }, [sprintError, showError]);
  
  useEffect(() => {
    if (taskError) {
      showError(`Task error: ${taskError}`);
    }
  }, [taskError, showError]);
  
  useEffect(() => {
    if (membersError) {
      showError(`Failed to load members: ${membersError.message}`);
    }
  }, [membersError, showError]);

  // Guard against no project selected (after all hooks)
  if (!selectedProjectId) {
    return (
      <div className="create-sprint-container with-footer-pad">
        <div className="no-project-message">
          <h2>No Project Selected</h2>
          <p>Please select a project from the Projects page to create a task.</p>
          <button onClick={() => navigate('/projects')} className="primary-action-btn">
            Go to Projects
          </button>
        </div>
      </div>
    );
  }

  /**
   * handleCreateTaskSubmit
   * 
   * Validates form data and submits the task creation request
   */
  const handleCreateTaskSubmit = async (): Promise<void> => {
    if (!description.trim()) {
      showError("Task description is required");
      return;
    }

    if (!sprintID) {
      showError("Please select a sprint");
      return;
    }

    setIsSubmitting(true);

    try {
      const taskData = {
        description: description.trim(),
        sprintID: sprintID,
        assigneeId: assigneeID || undefined
      };

      console.log("🔄 Creating task:", taskData);
      const result = await handleCreateTask(taskData);
      
      if (result.success) {
        console.log("✅ Task created successfully");
        showSuccess("Task created successfully");
        // Navigate back to backlog, preserving the sprint view if we came from a sprint
        if (preselectedSprintId) {
          navigate(`/backlog?sprintId=${preselectedSprintId}`);
        } else {
        navigate('/backlog');
        }
      } else {
        showError(result.error || "Failed to create task");
      }
    } catch (error: any) {
      console.error("❌ Error creating task:", error);
      showError(error.message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * handleKeyDown
   * 
   * Allows form submission via Enter key
   */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !isSubmitting) {
      handleCreateTaskSubmit();
    }
  };

  return (
    <div ref={containerRef} className="create-sprint-container with-footer-pad">
      {/* Apple-Style Navigation Bar */}
      <div className="create-sprint-nav-bar">
          <button 
            className="back-nav-btn" 
            onClick={() => navigate('/backlog')} 
            disabled={isSubmitting}
          >
            Back
          </button>
          <h1 className="create-sprint-title">Create Task</h1>
          <div className="nav-spacer"></div>
        </div>


      <form className="create-sprint-form" onSubmit={(e) => e.preventDefault()}>
          {/* Task Description */}
          <div className="form-group">
          <label htmlFor="description" className="form-label">Task Description *</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter task description..."
              className="form-input"
              rows={4}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Sprint Selection */}
          <div className="form-group">
          <label htmlFor="sprint" className="form-label">Sprint *</label>
            {sprintsLoading ? (
              <div className="loading-spinner">
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>Loading sprints...</span>
              </div>
            ) : (
              <select
                id="sprint"
                value={sprintID}
                onChange={(e) => setSprintID(e.target.value)}
                className="form-input"
                disabled={isSubmitting}
                required
              >
                <option value="">Select a sprint...</option>
                {sprints.map((sprint: Sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name} ({new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Assignee Selection */}
          <div className="form-group">
          <label htmlFor="assignee" className="form-label">Assignee (Optional)</label>
            {membersLoading ? (
              <div className="loading-spinner">
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>Loading members...</span>
              </div>
            ) : (
              <select
                id="assignee"
                value={assigneeID}
                onChange={(e) => setAssigneeID(e.target.value)}
                className="form-input"
                disabled={isSubmitting}
              >
                <option value="">Unassigned</option>
                {members.map((member: User) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Submit Button */}
          <div className="form-actions">
            <button
              type="button"
              onClick={handleCreateTaskSubmit}
              disabled={isSubmitting || !description.trim() || !sprintID}
            className="primary-action-btn"
            >
              {isSubmitting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />
                  Creating Task...
                </>
              ) : (
                'Create Task'
              )}
            </button>
          </div>
      </form>
    </div>
  );
};

export default CreateTask;

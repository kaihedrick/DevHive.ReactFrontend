import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getSelectedProject } from "../services/storageService";
import { useTask } from "../hooks/useTasks.ts";
import { useProjectMembers } from "../hooks/useProjects.ts";
import { useSprints } from "../hooks/useSprints.ts";
import { useUpdateTask } from "../hooks/useTasks.ts";
import "../styles/create_task.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { User, Sprint } from "../types/hooks.ts";

/**
 * EditTask Component
 * 
 * Renders a form to edit a task's description, assignee, and sprint.
 * Retrieves the task details, members, and sprints associated with the project.
 */
const EditTask: React.FC = () => {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const location = useLocation();
  
  const previousPage = location.state?.from || "/backlog";

  const [description, setDescription] = useState<string>("");
  const [assigneeID, setAssigneeID] = useState<string>("");
  const [sprintID, setSprintID] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const selectedProjectId = getSelectedProject();

  // Use TanStack Query hooks
  const { data: task, isLoading: taskLoading, error: taskError } = useTask(taskId);
  const { data: membersData, isLoading: membersLoading, error: membersError } = useProjectMembers(selectedProjectId);
  const { data: sprintsData, isLoading: sprintsLoading, error: sprintsError } = useSprints(selectedProjectId);
  const updateTaskMutation = useUpdateTask();

  // Extract data from responses
  const members: User[] = useMemo(() => {
    if (!membersData) return [];
    return membersData.members || membersData || [];
  }, [membersData]);

  const sprints: Sprint[] = useMemo(() => {
    if (!sprintsData) return [];
    return sprintsData.sprints || sprintsData || [];
  }, [sprintsData]);

  const loading = taskLoading || membersLoading || sprintsLoading;

  // Initialize form fields when task data loads
  useEffect(() => {
    if (task) {
      setDescription(task.description || "");
      setAssigneeID(task.assigneeId || "");
      setSprintID(task.sprintId || "");
    }
  }, [task]);

  // Handle errors
  useEffect(() => {
    if (taskError) {
      setErrorMessage(taskError.message || "Failed to load task data");
    } else if (membersError) {
      setErrorMessage("Failed to load project members");
    } else if (sprintsError) {
      setErrorMessage("Failed to load sprints");
    } else {
      setErrorMessage("");
    }
  }, [taskError, membersError, sprintsError]);

  const handleUpdateTask = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!description.trim()) {
      setErrorMessage("Description is required");
      return;
    }

    if (!taskId) {
      setErrorMessage("Task ID is missing");
      return;
    }

    try {
      await updateTaskMutation.mutateAsync({
        taskId,
        taskData: {
          description: description.trim(),
          assigneeId: assigneeID || null,
          sprintId: sprintID || null
        }
      });

      navigate(previousPage);
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to update task");
    }
  };

  if (loading) {
    return (
      <div className="create-task-container with-footer-pad">
        <div className="loading-message">
          <p>Loading task data...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="create-task-container with-footer-pad">
        <div className="error-message">
          <p>{errorMessage}</p>
          <button onClick={() => navigate(previousPage)} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-task-container with-footer-pad">
      <div className="create-task-header">
        <h1>Edit Task</h1>
        <button 
          onClick={() => navigate(previousPage)} 
          className="btn-secondary"
        >
          <FontAwesomeIcon icon={faArrowRotateLeft} />
          Back
        </button>
      </div>

      <form onSubmit={handleUpdateTask} className="create-task-form">
        <div className="form-group">
          <label htmlFor="description">Task Description *</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-textarea"
            placeholder="Enter task description"
            rows={4}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="assignee">Assign To</label>
          <select
            id="assignee"
            value={assigneeID}
            onChange={(e) => setAssigneeID(e.target.value)}
            className="form-select"
          >
            <option value="">Unassigned</option>
            {members.map((member: User) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="sprint">Sprint</label>
          <select
            id="sprint"
            value={sprintID}
            onChange={(e) => setSprintID(e.target.value)}
            className="form-select"
          >
            <option value="">No Sprint</option>
            {sprints.map((sprint: Sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
        </div>

        {errorMessage && (
          <div className="error-message">
            <p>{errorMessage}</p>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Update Task
          </button>
          <button 
            type="button" 
            onClick={() => navigate(previousPage)} 
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditTask;




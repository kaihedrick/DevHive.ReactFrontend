import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { fetchTaskById, updateTask } from "../services/taskService";
import { fetchProjectMembers, fetchProjectSprints } from "../services/projectService";
import { getSelectedProject } from "../services/storageService";
import { fetchProjectSprints as fetchSprints } from "../services/sprintService";
import "../styles/create_task.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { Task, User, Sprint } from "../types/hooks.ts";

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
  const sprint = location.state?.sprint || null;

  const [description, setDescription] = useState<string>("");
  const [assigneeID, setAssigneeID] = useState<string>("");
  const [sprintID, setSprintID] = useState<string>("");
  const [members, setMembers] = useState<User[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const selectedProjectId = getSelectedProject();

  useEffect(() => {
    const loadTaskData = async (): Promise<void> => {
      if (!taskId || !selectedProjectId) {
        setErrorMessage("Missing task ID or project ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        const [task, membersResponse, sprintsResponse] = await Promise.all([
          fetchTaskById(taskId),
          fetchProjectMembers(selectedProjectId),
          fetchSprints(selectedProjectId)
        ]);

        setDescription(task.description);
        setAssigneeID(task.assigneeId || "");
        setSprintID(task.sprintId || "");
        setMembers(membersResponse.members || membersResponse || []);
        setSprints(sprintsResponse.sprints || sprintsResponse || []);
      } catch (error: any) {
        setErrorMessage(error.message || "Failed to load task data");
      } finally {
        setLoading(false);
      }
    };

    loadTaskData();
  }, [taskId, selectedProjectId]);

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
      await updateTask(taskId, {
        description: description.trim(),
        assigneeId: assigneeID || null,
        sprintId: sprintID || null
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




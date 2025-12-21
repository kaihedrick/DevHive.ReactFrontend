import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSelectedProject } from "../services/storageService";
import { useSprints } from "../hooks/useSprints.ts";
import { useProjectMembers } from "../hooks/useProjects.ts";
import { useSprintTasks, useUpdateTask } from "../hooks/useTasks.ts";
import useBacklogActions from "../hooks/useBacklogActions.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faExclamationCircle, faCog } from "@fortawesome/free-solid-svg-icons";
import { Sprint, Task, User } from "../types/hooks.ts";
import TaskInspector from "./TaskInspector.tsx";
import SprintInspector from "./SprintInspector.tsx";
import { useToast } from "../contexts/ToastContext.tsx";
import "../styles/backlog.css";

interface BacklogProps {
  projectId?: string;
}

/**
 * Backlog Component
 *
 * Displays sprint overviews and allows viewing and managing tasks within a selected sprint.
 * Supports task status updates, inline editing, assignee assignment, and sprint navigation.
 */
const Backlog: React.FC<BacklogProps> = ({ projectId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
  
  const { handleUpdateTaskStatus } = useBacklogActions();

  // UI state only
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  
  // Stabilize projectId to prevent remounts during navigation
  // Read once and memoize - don't re-read on every render
  // This prevents hooks from seeing null/value/null flips that cause remounts
  const storedProjectId = useMemo(() => getSelectedProject(), []); // Only read once on mount
  const selectedProjectId = projectId || storedProjectId;

  // TanStack Query hooks for data fetching
  const { data: sprintsData, isLoading: sprintsLoading, error: sprintsError } = useSprints(selectedProjectId);
  const { data: membersData, isLoading: membersLoading, error: membersError } = useProjectMembers(selectedProjectId);
  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useSprintTasks(selectedSprint?.id || null);
  
  // Mutation hooks
  const updateTaskMutation = useUpdateTask();

  // Extract data arrays from TanStack Query responses
  const sprints: Sprint[] = useMemo(() => {
    if (!sprintsData) return [];
    // Handle both array and object with sprints property
    if (Array.isArray(sprintsData)) {
      return sprintsData;
    }
    if (sprintsData && typeof sprintsData === 'object' && 'sprints' in sprintsData) {
      return Array.isArray(sprintsData.sprints) ? sprintsData.sprints : [];
    }
    return [];
  }, [sprintsData]);

  const members: User[] = useMemo(() => {
    if (!membersData) return [];
    // Handle both array and object with members property
    if (Array.isArray(membersData)) {
      return membersData;
    }
    if (membersData && typeof membersData === 'object' && 'members' in membersData) {
      return Array.isArray(membersData.members) ? membersData.members : [];
    }
    return [];
  }, [membersData]);

  const tasks: Task[] = useMemo(() => {
    if (!tasksData) return [];
    // Handle both array and object with tasks property
    if (Array.isArray(tasksData)) {
      return tasksData;
    }
    if (tasksData && typeof tasksData === 'object' && 'tasks' in tasksData) {
      return Array.isArray(tasksData.tasks) ? tasksData.tasks : [];
    }
    return [];
  }, [tasksData]);

  // Combine loading states
  const loading = sprintsLoading || membersLoading || tasksLoading;

  // Show errors from TanStack Query hooks
  useEffect(() => {
    if (sprintsError) {
      showError(`Failed to load sprints: ${sprintsError}`);
    }
    if (membersError) {
      showError(`Failed to load members: ${membersError}`);
    }
    if (tasksError) {
      showError(`Failed to load tasks: ${tasksError}`);
    }
  }, [sprintsError, membersError, tasksError, showError]);

  const handleSprintClick = (sprint: Sprint): void => {
    setSelectedSprint(sprint);
    // Tasks will automatically load via useSprintTasks hook when selectedSprint changes
  };

  // Status cycling function
  const handleStatusCycle = async (task: Task): Promise<void> => {
    const nextStatus = (task.status + 1) % 3; // Cycle: 0 → 1 → 2 → 0
    await handleStatusChange(task, nextStatus);
  };

  // Status icon helper
  const getStatusIcon = (status: number): string => {
    switch (status) {
      case 0: return '○'; // To Do
      case 1: return '◐'; // In Progress  
      case 2: return '●'; // Completed
      default: return '○';
    }
  };

  // Assignee initials helper
  const getAssigneeInitials = (assigneeId: string): string => {
    const member = members.find(m => m.id === assigneeId);
    if (!member) return '';
    return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  };

  // Handle assignee click
  const handleAssignClick = (task: Task, e: React.MouseEvent): void => {
    e.stopPropagation();
    setSelectedTaskForEdit(task);
    setInspectorOpen(true);
  };

  // Handle task row click - open inspector
  const handleTaskClick = (task: Task): void => {
    setSelectedTaskForEdit(task);
    setInspectorOpen(true);
  };

  // Handle URL params for sprintId to restore sprint view
  useEffect(() => {
    if (!selectedProjectId) {
      showError("No Project ID found. Please select a project.");
      return;
    }

    // Check URL params for sprintId to restore sprint view
    const queryParams = new URLSearchParams(location.search);
    const sprintIdFromUrl = queryParams.get('sprintId');
    if (sprintIdFromUrl && sprints.length > 0 && !selectedSprint) {
      const sprintToSelect = sprints.find((s: Sprint) => s.id === sprintIdFromUrl);
      if (sprintToSelect) {
        // Automatically select the sprint (tasks will load via useSprintTasks)
        setSelectedSprint(sprintToSelect);
        // Clean up URL params after restoring state
        navigate('/backlog', { replace: true });
      }
    }
  }, [selectedProjectId, location.search, sprints, selectedSprint, navigate, showError]);

  // Helper function to get status text
  const getStatusText = (status: number): string => {
    if (status === 0) return 'To Do';
    if (status === 1) return 'In Progress';
    return 'Completed';
  };

  const handleStatusChange = async (task: Task, newStatus: number): Promise<void> => {
    try {
      await handleUpdateTaskStatus(task, newStatus);
      // Cache invalidation handled automatically by mutation/WebSocket
      // Update selectedTaskForEdit optimistically for immediate UI feedback
      if (selectedTaskForEdit?.id === task.id) {
        setSelectedTaskForEdit({ ...task, status: newStatus });
      }
      showSuccess(`Task status updated to ${getStatusText(newStatus)}`);
    } catch (err: any) {
      console.error("Failed to update task status:", err);
      showError("Failed to update task status.");
    }
  };

  const handleAssigneeChange = async (task: Task, newAssigneeId: string): Promise<void> => {
    try {
      console.log("🔄 Updating assignee for task:", task.id, "to assignee:", newAssigneeId);
      
      // Convert empty string to null for unassignment
      const assigneeValue = newAssigneeId === '' || newAssigneeId === null ? null : newAssigneeId;
      
      await updateTaskMutation.mutateAsync({ 
        taskId: task.id, 
        taskData: { assigneeId: assigneeValue }
      });
      
      // Cache invalidation handled automatically by mutation/WebSocket
      // Update selectedTaskForEdit optimistically for immediate UI feedback
      if (selectedTaskForEdit?.id === task.id) {
        setSelectedTaskForEdit({ ...task, assigneeId: assigneeValue ?? undefined });
      }
      showSuccess("Task assignee updated");
    } catch (err: any) {
      console.error("❌ Error updating task assignee:", err);
      console.error("❌ Error details:", err.response?.data || err.message);
      showError(`Failed to update task assignee: ${err.message}`);
    }
  };

  const handleSprintSettingsClick = (e: React.MouseEvent, sprint: Sprint): void => {
    e.stopPropagation(); // Prevent sprint click from firing
    e.preventDefault(); // Prevent any default behavior
    console.log('Edit sprint clicked:', sprint.name); // Debug log
    if (!selectedProjectId) {
      showError("No project selected. Cannot edit sprint.");
      return;
    }
    // Open SprintInspector panel instead of navigating
    setEditingSprint(sprint);
  };


  // Helper function to handle create navigation
  const handleCreateNavigation = (): void => {
    if (!selectedProjectId) {
      console.error('Cannot create sprint/task: No project selected');
      return;
    }
    if (selectedSprint) {
      navigate(`/create-task?projectId=${selectedProjectId}&sprintId=${selectedSprint.id}`);
    } else {
      const navigateUrl = selectedProjectId ? `/create-sprint?projectId=${selectedProjectId}` : '/create-sprint';
      navigate(navigateUrl);
    }
  };

  // Helper function to handle create sprint navigation
  const handleCreateSprintNavigation = (): void => {
    if (!selectedProjectId) {
      console.error('Cannot create sprint: No project selected');
      return;
    }
    const navigateUrl = selectedProjectId ? `/create-sprint?projectId=${selectedProjectId}` : '/create-sprint';
    navigate(navigateUrl);
  };

  // Helper function to get status aria label
  const getStatusAriaLabel = (status: number): string => {
    const statusText = getStatusText(status);
    return `Status: ${statusText}. Click to cycle.`;
  };

  // Helper function to get assignee display name
  const getAssigneeDisplayName = (assigneeId: string): string => {
    const member = members.find(m => m.id === assigneeId);
    return member ? `${member.firstName} ${member.lastName}` : '';
  };

  if (loading) {
    return (
      <div className="backlog-page">
        <div className="backlog-container with-footer-pad scroll-pad-bottom">
          <div className="loading-message">
            <FontAwesomeIcon icon={faExclamationCircle} spin />
            <p>Loading backlog...</p>
          </div>
        </div>
      </div>
    );
  }


  if (!selectedProjectId) {
    return (
      <div className="backlog-page">
        <header className="backlog-header" aria-label="Backlog header">
          <div className="header-left">
            <h1 className="page-title">Backlog</h1>
            <p className="page-subtitle">Manage your sprints and tasks</p>
          </div>
        </header>
        <div className="backlog-container">
          <div className="empty-state">
            <div className="empty-illustration" aria-hidden>📁</div>
            <h2 className="empty-title">No Project Selected</h2>
            <p className="empty-subtitle">Please select a project to view the backlog.</p>
            <div className="empty-actions">
              <button onClick={() => navigate('/projects')} className="empty-action-btn">
                Go to Projects
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="backlog-page with-footer-pad scroll-pad-bottom">
        <header className="backlog-header" aria-label="Backlog header">
          <div className="header-left">
            <h1 className="page-title">
              {selectedSprint ? `Sprint: ${selectedSprint.name}` : 'Backlog'}
            </h1>
            <p className="page-subtitle">
              {selectedSprint ? 'Manage tasks in this sprint' : 'Manage your sprints and tasks'}
            </p>
          </div>

          {/* Actions toolbar - visible on all screen sizes */}
          <div className="backlog-toolbar">
            <button 
              className="primary-action-btn"
              onClick={handleCreateNavigation}
            >
              <span className="btn-icon" aria-hidden>＋</span>
              {selectedSprint ? 'Task' : 'Sprint'}
            </button>
            {selectedSprint && (
              <button 
                className="secondary-action-btn"
                onClick={() => setSelectedSprint(null)}
              >
                Back to Sprints
              </button>
            )}
          </div>
        </header>

        <div className="backlog-container">

      {!selectedSprint ? (
        // Sprint Overview
        <div className="sprint-overview">
          
          {!sprints || sprints.length === 0 ? (
            <div className="empty-state">
              <div className="empty-illustration" aria-hidden>📋</div>
              <h2 className="empty-title">No Sprints Available</h2>
              <p className="empty-subtitle">Create a sprint to get started with your project backlog.</p>
              <div className="empty-actions">
                <button 
                  onClick={handleCreateSprintNavigation} 
                  className="empty-action-btn"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Create Sprint
                </button>
              </div>
            </div>
          ) : (
            <div className="sprints-list" role="list">
              {sprints && sprints.map((sprint: Sprint) => (
                <article
                  key={sprint.id} 
                  className="sprint-item"
                  role="listitem button"
                  onClick={() => handleSprintClick(sprint)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSprintClick(sprint);
                    }
                  }}
                  aria-label={`Open sprint ${sprint.name}`}
                >
                  <div className="card-content">
                    <h3 className="sprint-name">{sprint.name}</h3>
                    <p className="sprint-metadata">
                      {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                    </p>
                    <span className={`status-badge ${sprint.isStarted ? 'active' : 'inactive'}`}>
                      {sprint.isStarted ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  {/* Sprint Settings Button */}
                  <button
                    type="button"
                    aria-label={`Sprint settings for ${sprint.name}`}
                    className="card-settings-btn"
                    onClick={(e) => handleSprintSettingsClick(e, sprint)}
                  >
                    <FontAwesomeIcon icon={faCog} className="icon" aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Task List for Selected Sprint
        <div className="sprint-tasks">
          
          <div className="tasks-container">
            {!tasks || tasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-illustration" aria-hidden>✓</div>
                <h2 className="empty-title">No Tasks in This Sprint</h2>
                <p className="empty-subtitle">Create a task to get started with this sprint.</p>
                <div className="empty-actions">
                  <button 
                    onClick={() => navigate(`/create-task?projectId=${selectedProjectId}&sprintId=${selectedSprint.id}`)} 
                    className="empty-action-btn"
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Create Task
                  </button>
                </div>
              </div>
            ) : (
              <div className="tasks-adaptive">
                {tasks && tasks.map((task: Task) => (
                  <div 
                    key={task.id} 
                    className="task-row" 
                    onClick={() => handleTaskClick(task)}
                  >
                    <div className="task-row-content">
                      {/* Status indicator (pill/dot) */}
                      <button 
                        className="task-status-pill"
                        onClick={(e) => { e.stopPropagation(); handleStatusCycle(task); }}
                        aria-label={getStatusAriaLabel(task.status)}
                      >
                        {getStatusIcon(task.status)}
                      </button>
                      
                      {/* Task title */}
                      <span className="task-row-title">{task.description}</span>
                      
                      {/* Assignee avatar */}
                      <div className="task-assignee-avatar">
                        {task.assigneeId ? (
                          <div className="assignee-avatar-initials" title={getAssigneeDisplayName(task.assigneeId)}>
                            {getAssigneeInitials(task.assigneeId)}
                          </div>
                        ) : (
                          <button 
                            className="assignee-placeholder" 
                            onClick={(e) => handleAssignClick(task, e)}
                            aria-label="Assign task"
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Inspector Panel */}
      <TaskInspector
        task={selectedTaskForEdit}
        isOpen={inspectorOpen}
        onClose={() => {
          setInspectorOpen(false);
          setSelectedTaskForEdit(null);
        }}
        onUpdate={(updatedTask: Task) => {
          // Cache invalidation handled automatically by mutation/WebSocket
          // Update selectedTaskForEdit to reflect changes if inspector is still open
          setSelectedTaskForEdit(updatedTask);
        }}
        members={members}
        onStatusChange={handleStatusChange}
        onAssigneeChange={handleAssigneeChange}
        onDescriptionUpdate={async (taskId: string, description: string) => {
          try {
            await updateTaskMutation.mutateAsync({ taskId, taskData: { description } });
            const updatedTask = tasks.find(t => t.id === taskId);
            if (updatedTask && selectedTaskForEdit?.id === taskId) {
              setSelectedTaskForEdit({ ...updatedTask, description });
            }
          } catch (err: any) {
            console.error("Failed to update task description:", err);
            showError("Failed to update task description.");
          }
        }}
        />

      {/* Sprint Inspector Panel */}
      <SprintInspector
        sprint={editingSprint}
        isOpen={!!editingSprint}
        onClose={() => setEditingSprint(null)}
        onUpdate={() => {
          // Cache invalidation handled automatically by mutation/WebSocket
          setEditingSprint(null);
        }}
        onDelete={() => {
          setEditingSprint(null);
          if (selectedSprint?.id === editingSprint?.id) {
            setSelectedSprint(null);
          }
        }}
      />
        </div>
      </div>
    );
  };

export default Backlog;

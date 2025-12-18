import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchProjectMembers } from "../services/projectService";
import { fetchProjectSprints } from "../services/sprintService";
import { fetchProjectTasksWithAssignees, fetchTaskById, updateTask, assignTask } from "../services/taskService";
import { getSelectedProject } from "../services/storageService";
import useBacklogActions from "../hooks/useBacklogActions.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCheck, faXmark, faPenToSquare, faPlus, faTimes, faExclamationTriangle, faExclamationCircle, faEllipsisVertical, faChevronLeft, faCog } from "@fortawesome/free-solid-svg-icons";
import { Sprint, Task, User } from "../types/hooks.ts";
import TaskInspector from "./TaskInspector.tsx";
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

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditingTask, setIsEditingTask] = useState<string | null>(null);
  const [editedDescription, setEditedDescription] = useState<string>("");
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);
  const selectedProjectId = projectId || getSelectedProject();

  const handleSprintClick = async (sprint: Sprint): Promise<void> => {
    setSelectedSprint(sprint);
    setLoading(true);
    try {
      const fetchedTasks = await fetchProjectTasksWithAssignees(selectedProjectId);
      const tasksArray = Array.isArray(fetchedTasks) ? fetchedTasks : [];
      const sprintTasks = tasksArray.filter((task: Task) => task.sprintId === sprint.id);
      setTasks(sprintTasks);
    } catch (err: any) {
      showError("Failed to fetch sprint tasks.");
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    if (!selectedProjectId) {
      showError("No Project ID found. Please select a project.");
      setLoading(false);
      return;
    }

    const loadSprintsAndMembers = async (): Promise<void> => {
      try {
        setLoading(true);
        const sprintsResponse = await fetchProjectSprints(selectedProjectId);
        const membersResponse = await fetchProjectMembers(selectedProjectId);
        const sprintsArray = Array.isArray(sprintsResponse.sprints) ? sprintsResponse.sprints : 
                            Array.isArray(sprintsResponse) ? sprintsResponse : [];
        setSprints(sprintsArray);
        setMembers(Array.isArray(membersResponse.members) ? membersResponse.members : 
                  Array.isArray(membersResponse) ? membersResponse : []);
        
        // Check URL params for sprintId to restore sprint view
        const queryParams = new URLSearchParams(location.search);
        const sprintIdFromUrl = queryParams.get('sprintId');
        if (sprintIdFromUrl && sprintsArray.length > 0) {
          const sprintToSelect = sprintsArray.find((s: Sprint) => s.id === sprintIdFromUrl);
          if (sprintToSelect) {
            // Automatically select the sprint and load its tasks
            await handleSprintClick(sprintToSelect);
            // Clean up URL params after restoring state
            navigate('/backlog', { replace: true });
          }
        }
      } catch (err: any) {
        showError(err.message || "An error occurred while fetching data.");
      } finally {
        setLoading(false);
      }
    };

    loadSprintsAndMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, location.search]);

  const handleStatusChange = async (task: Task, newStatus: number): Promise<void> => {
    try {
      await handleUpdateTaskStatus(task, newStatus);
      const updatedTask = { ...task, status: newStatus };
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === task.id ? updatedTask : t
        )
      );
      // Update selectedTaskForEdit if inspector is open for this task
      if (selectedTaskForEdit?.id === task.id) {
        setSelectedTaskForEdit(updatedTask);
      }
      showSuccess(`Task status updated to ${newStatus === 0 ? 'To Do' : newStatus === 1 ? 'In Progress' : 'Completed'}`);
    } catch (err: any) {
      showError("Failed to update task status.");
    }
  };

  const handleAssigneeChange = async (task: Task, newAssigneeId: string): Promise<void> => {
    try {
      console.log("🔄 Updating assignee for task:", task.id, "to assignee:", newAssigneeId);
      
      if (newAssigneeId === '' || newAssigneeId === null) {
        // Handle unassignment - we might need to implement unassignTask or use updateTask
        console.log("📤 Unassigning task:", task.id);
        await updateTask(task.id, { assigneeId: null });
      } else {
        // Use assignTask for proper assignee assignment
        console.log("📤 Assigning task:", task.id, "to user:", newAssigneeId);
        await assignTask(task.id, newAssigneeId);
      }
      
      const updatedTask = { ...task, assigneeId: newAssigneeId || null };
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === task.id ? updatedTask : t
        )
      );
      // Update selectedTaskForEdit if inspector is open for this task
      if (selectedTaskForEdit?.id === task.id) {
        setSelectedTaskForEdit(updatedTask);
      }
      showSuccess("Task assignee updated");
    } catch (err: any) {
      console.error("❌ Error updating task assignee:", err);
      console.error("❌ Error details:", err.response?.data || err.message);
      showError(`Failed to update task assignee: ${err.message}`);
    }
  };

  const handleEditTask = async (taskId: string): Promise<void> => {
    try {
      const task = await fetchTaskById(taskId);
      setIsEditingTask(taskId);
      setEditedDescription(task.description);
    } catch (err: any) {
      showError("Failed to load task for editing.");
    }
  };

  const handleSaveEdit = async (taskId: string): Promise<void> => {
    try {
      await updateTask(taskId, { description: editedDescription });
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === taskId ? { ...t, description: editedDescription } : t
        )
      );
      setIsEditingTask(null);
      setEditedDescription("");
      showSuccess("Task updated successfully");
    } catch (err: any) {
      showError("Failed to update task.");
    }
  };

  const handleCancelEdit = (): void => {
    setIsEditingTask(null);
    setEditedDescription("");
  };

  const handleSprintSettingsClick = (e: React.MouseEvent, sprint: Sprint): void => {
    e.stopPropagation(); // Prevent sprint click from firing
    e.preventDefault(); // Prevent any default behavior
    console.log('Edit sprint clicked:', sprint.name); // Debug log
    if (!selectedProjectId) {
      showError("No project selected. Cannot edit sprint.");
      return;
    }
    // Navigate to edit sprint page
    navigate(`/edit-sprint/${sprint.id}`);
  };

  const refreshSprints = async (): Promise<void> => {
    try {
      const sprintsData = await fetchProjectSprints(selectedProjectId);
      setSprints(sprintsData.sprints || sprintsData || []);
    } catch (err: any) {
      console.error("Error refreshing sprints:", err);
      showError("Failed to refresh sprints");
    }
  };


  const getStatusName = (status: number): string => {
    const statusMap = { 0: "To Do", 1: "In Progress", 2: "Completed" };
    return statusMap[status] || "Unknown";
  };

  const getStatusColor = (status: number): string => {
    const colorMap = { 
      0: "status-todo", 
      1: "status-in-progress", 
      2: "status-completed" 
    };
    return colorMap[status] || "status-unknown";
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
        {/* #region agent log */}
        {(() => {
          const logHeaderStyles = () => {
            setTimeout(() => {
              const header = document.querySelector('.backlog-page .backlog-header') as HTMLElement;
              const projectsHeader = document.querySelector('.projects-page .projects-header') as HTMLElement;
              if (header) {
                const computed = window.getComputedStyle(header);
                fetch('http://127.0.0.1:7242/ingest/3b72928f-107f-4672-aa90-6d4285c21018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Backlog.tsx:258',message:'Backlog header computed styles',data:{background:computed.background,backgroundColor:computed.backgroundColor,backgroundImage:computed.backgroundImage,backdropFilter:computed.backdropFilter,getPropertyValue_bgSecondary:computed.getPropertyValue('--bg-secondary'),allRules:Array.from(document.styleSheets).flatMap(sheet=>{try{return Array.from(sheet.cssRules||[]).filter(r=>r.selectorText?.includes('backlog-header')).map(r=>({selector:r.selectorText,style:(r as CSSStyleRule).style.cssText})).slice(0,5)}catch{return[]}})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
              }
              if (projectsHeader) {
                const computed = window.getComputedStyle(projectsHeader);
                fetch('http://127.0.0.1:7242/ingest/3b72928f-107f-4672-aa90-6d4285c21018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Backlog.tsx:258',message:'Projects header computed styles',data:{background:computed.background,backgroundColor:computed.backgroundColor,backgroundImage:computed.backgroundImage,backdropFilter:computed.backdropFilter,getPropertyValue_bgSecondary:computed.getPropertyValue('--bg-secondary'),allRules:Array.from(document.styleSheets).flatMap(sheet=>{try{return Array.from(sheet.cssRules||[]).filter(r=>r.selectorText?.includes('projects-header')).map(r=>({selector:r.selectorText,style:(r as CSSStyleRule).style.cssText})).slice(0,5)}catch{return[]}})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
              }
            }, 100);
          };
          logHeaderStyles();
          return null;
        })()}
        {/* #endregion */}
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
              onClick={() => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/3b72928f-107f-4672-aa90-6d4285c21018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Backlog.tsx:290',message:'Create Sprint/Task button clicked',data:{selectedProjectId,projectId,selectedSprint:selectedSprint?.id,hasSelectedSprint:!!selectedSprint},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                if (!selectedProjectId) {
                  console.error('Cannot create sprint/task: No project selected');
                  return;
                }
                if (selectedSprint) {
                  navigate(`/create-task?projectId=${selectedProjectId}&sprintId=${selectedSprint.id}`);
                } else {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/3b72928f-107f-4672-aa90-6d4285c21018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Backlog.tsx:300',message:'Navigating to create-sprint',data:{selectedProjectId,navigateUrl:`/create-sprint?projectId=${selectedProjectId}`},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
                  // #endregion
                  // Only add projectId query param if it's valid (not undefined/null)
                  const navigateUrl = selectedProjectId ? `/create-sprint?projectId=${selectedProjectId}` : '/create-sprint';
                  navigate(navigateUrl);
                }
              }}
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
                  onClick={() => {
                    if (!selectedProjectId) {
                      console.error('Cannot create sprint: No project selected');
                      return;
                    }
                    // Only add projectId query param if it's valid (not undefined/null)
                    const navigateUrl = selectedProjectId ? `/create-sprint?projectId=${selectedProjectId}` : '/create-sprint';
                    navigate(navigateUrl);
                  }} 
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
                    <span className={`status-badge ${sprint.isActive ? 'active' : 'inactive'}`}>
                      {sprint.isActive ? 'Active' : 'Inactive'}
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
                        aria-label={`Status: ${task.status === 0 ? 'To Do' : task.status === 1 ? 'In Progress' : 'Completed'}. Click to cycle.`}
                      >
                        {getStatusIcon(task.status)}
                      </button>
                      
                      {/* Task title */}
                      <span className="task-row-title">{task.description}</span>
                      
                      {/* Assignee avatar */}
                      <div className="task-assignee-avatar">
                        {task.assigneeId ? (
                          <div className="assignee-avatar-initials" title={members.find(m => m.id === task.assigneeId)?.firstName + ' ' + members.find(m => m.id === task.assigneeId)?.lastName}>
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
          // This callback ensures the task state is synced after all updates
          setTasks(prevTasks => 
            prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t)
          );
          // Also update selectedTaskForEdit to reflect changes if inspector is still open
          setSelectedTaskForEdit(updatedTask);
        }}
        members={members}
        onStatusChange={handleStatusChange}
        onAssigneeChange={handleAssigneeChange}
        onDescriptionUpdate={async (taskId: string, description: string) => {
          try {
            await updateTask(taskId, { description });
            const updatedTask = tasks.find(t => t.id === taskId);
            if (updatedTask) {
              const taskWithNewDescription = { ...updatedTask, description };
              setTasks(prevTasks => 
                prevTasks.map(t => t.id === taskId ? taskWithNewDescription : t)
              );
              // Update selectedTaskForEdit if inspector is open for this task
              if (selectedTaskForEdit?.id === taskId) {
                setSelectedTaskForEdit(taskWithNewDescription);
              }
            }
          } catch (err: any) {
            showError("Failed to update task description.");
          }
          }}
        />
        </div>
      </div>
    );
  };

export default Backlog;

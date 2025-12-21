import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSelectedProject } from '../services/storageService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faBars } from '@fortawesome/free-solid-svg-icons';
import useBoardActions from '../hooks/useBoardActions.ts';
import { Task, Sprint, User } from '../types/hooks.ts';
import TaskInspector from './TaskInspector.tsx';
import { updateTask } from '../services/taskService';
import '../styles/board.css';

/**
 * Board Component
 *
 * Displays a Kanban-style task board for a selected project and sprint.
 * Supports drag-and-drop task movement across three status columns.
 *
 * @returns {JSX.Element} The full task board with status columns and sprint selector
 */
const Board: React.FC = () => {
  const navigate = useNavigate();
  
  // Stabilize projectId to prevent remounts during navigation
  // Read once and memoize - don't re-read on every render
  // This prevents hooks from seeing null/value/null flips that cause remounts
  const projectId = useMemo(() => getSelectedProject(), []); // Only read once on mount
  
  // Always call hooks first, before any conditional returns
  const {
    sprints,
    selectedSprint,
    tasks,
    members,
    loading,
    error,
    successMessage,
    draggedTask,
    setDraggedTask,
    setError,
    getTasksByStatus,
    formatDate,
    getAssigneeName,
    handleSprintChange,
    handleAssigneeChange,
    handleStatusUpdate,
    setSuccessMessage
  } = useBoardActions(projectId || '');

  const columnRefs = {
    todo: useRef<HTMLDivElement>(null),
    inProgress: useRef<HTMLDivElement>(null),
    completed: useRef<HTMLDivElement>(null)
  };

  // TaskInspector state
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(false);

  // Mobile drag-and-drop state
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [draggedTaskElement, setDraggedTaskElement] = useState<HTMLElement | null>(null);
  const [showMobileDropZones, setShowMobileDropZones] = useState<boolean>(false);
  const [dropZonePosition, setDropZonePosition] = useState<{ top: number; left: number } | null>(null);
  const draggedTaskRef = useRef<HTMLElement | null>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Assignee initials helper
  const getAssigneeInitials = (assigneeId: string): string => {
    const member = members.find(m => m.id === assigneeId);
    if (!member) return '';
    return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  };

  // Handle task click - open inspector
  const handleTaskClick = (task: Task, e?: React.MouseEvent): void => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedTaskForEdit(task);
    setInspectorOpen(true);
  };

  // Handle assignee avatar click - open inspector
  const handleAssignClick = (task: Task, e: React.MouseEvent): void => {
    e.stopPropagation();
    setSelectedTaskForEdit(task);
    setInspectorOpen(true);
  };

  // Handle status change from inspector
  const handleStatusChangeFromInspector = async (task: Task, newStatus: number): Promise<void> => {
    const success = await handleStatusUpdate(task.id, newStatus);
    if (success) {
      // Update selectedTaskForEdit if inspector is open for this task
      if (selectedTaskForEdit?.id === task.id) {
        setSelectedTaskForEdit({ ...task, status: newStatus });
      }
    }
  };

  // Handle assignee change from inspector
  const handleAssigneeChangeFromInspector = async (task: Task, newAssigneeId: string): Promise<void> => {
    await handleAssigneeChange(task, newAssigneeId);
    // Update selectedTaskForEdit if inspector is open for this task
    if (selectedTaskForEdit?.id === task.id) {
      setSelectedTaskForEdit({ ...task, assigneeId: newAssigneeId || null });
    }
  };

  // Handle description update from inspector
  const handleDescriptionUpdate = async (taskId: string, description: string): Promise<void> => {
    try {
      await updateTask(taskId, { description });
      // Update selectedTaskForEdit if inspector is open for this task
      if (selectedTaskForEdit?.id === taskId) {
        setSelectedTaskForEdit({ ...selectedTaskForEdit, description });
      }
    } catch (error) {
      console.error('Error updating task description:', error);
    }
  };


  // Guard against no project selected (after all hooks)
  if (!projectId) {
    return (
      <div className="board-page">
        <div className="board-container with-footer-pad scroll-pad-bottom">
          <div className="no-project-message">
            <h2>No Project Selected</h2>
            <p>Please select a project from the Projects page to view the board.</p>
            <button onClick={() => navigate('/projects')} className="btn-primary">
              Go to Projects
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, task: Task): void => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', (e.target as HTMLElement).outerHTML);
    
    // Hide browser drag ghost with transparent image
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';
    e.dataTransfer.setDragImage(img, 0, 0);
    
    // Add dragging class to the card for custom visual feedback
    const cardElement = e.currentTarget as HTMLElement;
    cardElement.classList.add('dragging');
    
    // Mobile-specific: Show drop zones under the task
    if (isMobile) {
      draggedTaskRef.current = cardElement;
      setDraggedTaskElement(cardElement);
      setShowMobileDropZones(true);
      
      // Calculate position for drop zones (right under the task)
      const rect = cardElement.getBoundingClientRect();
      const dropZoneWidth = Math.min(400, window.innerWidth - 32); // Max width with margins
      const taskCenter = rect.left + (rect.width / 2);
      const dropZoneLeft = Math.max(16, Math.min(taskCenter - (dropZoneWidth / 2), window.innerWidth - dropZoneWidth - 16));
      
      setDropZonePosition({
        top: rect.bottom + 8, // 8px gap below task (using viewport coordinates for fixed positioning)
        left: dropZoneLeft // Center relative to task, ensuring it stays on screen
      });
    }
  };

  const handleDragEnd = (e: React.DragEvent): void => {
    setDraggedTask(null);
    // Remove drag styling from card
    const cardElement = e.currentTarget as HTMLElement;
    cardElement.classList.remove('dragging');
    
    // Remove any drag-over styling from columns
    Object.values(columnRefs).forEach(ref => {
      if (ref.current) {
        ref.current.classList.remove('drag-over');
      }
    });
    
    // Mobile-specific: Hide drop zones
    if (isMobile) {
      setShowMobileDropZones(false);
      setDraggedTaskElement(null);
      setDropZonePosition(null);
      draggedTaskRef.current = null;
    }
  };

  const handleDragOver = (e: React.DragEvent, columnType: string): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Add visual feedback
    const columnRef = columnRefs[columnType as keyof typeof columnRefs];
    if (columnRef.current) {
      columnRef.current.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e: React.DragEvent, columnType: string): void => {
    const columnRef = columnRefs[columnType as keyof typeof columnRefs];
    if (columnRef.current && !columnRef.current.contains(e.relatedTarget as Node)) {
      columnRef.current.classList.remove('drag-over');
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: number): Promise<void> => {
    e.preventDefault();
    
    // Remove visual feedback
    Object.values(columnRefs).forEach(ref => {
      if (ref.current) {
        ref.current.classList.remove('drag-over');
      }
    });

    if (!draggedTask) return;

    const success = await handleStatusUpdate(draggedTask.id, newStatus);
    if (success) {
      setSuccessMessage(`Task moved to ${newStatus === 0 ? 'To Do' : newStatus === 1 ? 'In Progress' : 'Completed'}`);
      
      // Mobile-specific: Hide drop zones after successful drop
      if (isMobile) {
        setShowMobileDropZones(false);
        setDraggedTaskElement(null);
        setDropZonePosition(null);
        draggedTaskRef.current = null;
      }
    }
  };

  // Mobile-specific: Handle drop on mobile drop zones
  const handleMobileDrop = async (newStatus: number): Promise<void> => {
    if (!draggedTask) return;

    const success = await handleStatusUpdate(draggedTask.id, newStatus);
    if (success) {
      setSuccessMessage(`Task moved to ${newStatus === 0 ? 'To Do' : newStatus === 1 ? 'In Progress' : 'Completed'}`);
      setShowMobileDropZones(false);
      setDraggedTaskElement(null);
      setDropZonePosition(null);
      draggedTaskRef.current = null;
    }
  };

  if (loading) {
    return (
      <div className="board-container with-footer-pad scroll-pad-bottom">
        <div className="loading-message">
          <FontAwesomeIcon icon={faBars} spin />
          <p>Loading board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="board-container with-footer-pad scroll-pad-bottom">
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!selectedSprint || sprints.length === 0) {
    return (
      <div className="board-page">
        <div className="board-container with-footer-pad scroll-pad-bottom">
          <div className="no-sprint-message">
            <h2>No Sprint Selected</h2>
            <p>Please create a sprint or select an existing one to view tasks.</p>
            <button onClick={() => navigate('/create-sprint')} className="btn-primary">
              Create Sprint
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="board-page">
      <div className="board-container with-footer-pad scroll-pad-bottom">

      {/* Sprint Selector */}
      <div className="sprint-selector">
        <FontAwesomeIcon icon={faCalendarAlt} />
        <select 
          value={selectedSprint || ''} 
          onChange={handleSprintChange}
          className="sprint-dropdown"
        >
          <option value="">Select a sprint...</option>
          {sprints.map((sprint: Sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name} ({formatDate(sprint.startDate)} - {formatDate(sprint.endDate)})
            </option>
          ))}
        </select>
      </div>

      {/* Board Columns */}
      <div className="board-columns">
        {/* To Do Column */}
        <div className="board-column">
          <div className="board-column-header">
            <h3>To Do</h3>
            <div className="task-count">{getTasksByStatus(0).length}</div>
          </div>
          
          <div 
            ref={columnRefs.todo}
            className="board-column-content"
            onDragOver={(e) => handleDragOver(e, 'todo')}
            onDragLeave={(e) => handleDragLeave(e, 'todo')}
            onDrop={(e) => handleDrop(e, 0)}
          >
            {getTasksByStatus(0).map((task: Task) => {
              const assigneeMember = task.assigneeId ? members.find(m => m.id === task.assigneeId) : null;
              const assigneeFullName = assigneeMember ? `${assigneeMember.firstName} ${assigneeMember.lastName}` : '';
              
              return (
                <div 
                  key={task.id}
                  className="task-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="task-header">
                    <div className="task-title-wrapper">
                      <span className={`task-status-dot task-status-dot--todo`} aria-hidden="true"></span>
                      <h4 
                        className="task-title"
                        onClick={(e) => handleTaskClick(task, e)}
                      >
                        {task.description}
                      </h4>
                    </div>
                    <div className="task-assignee-avatar">
                      {task.assigneeId ? (
                        <div 
                          className="assignee-avatar-initials" 
                          title={assigneeFullName}
                          onClick={(e) => handleAssignClick(task, e)}
                        >
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
              );
            })}
            {getTasksByStatus(0).length === 0 && (
              <div className="empty-column-message">
                No tasks in this column
              </div>
            )}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="board-column">
          <div className="board-column-header">
            <h3>In Progress</h3>
            <div className="task-count">{getTasksByStatus(1).length}</div>
          </div>
          
          <div 
            ref={columnRefs.inProgress}
            className="board-column-content"
            onDragOver={(e) => handleDragOver(e, 'inProgress')}
            onDragLeave={(e) => handleDragLeave(e, 'inProgress')}
            onDrop={(e) => handleDrop(e, 1)}
          >
            {getTasksByStatus(1).map((task: Task) => {
              const assigneeMember = task.assigneeId ? members.find(m => m.id === task.assigneeId) : null;
              const assigneeFullName = assigneeMember ? `${assigneeMember.firstName} ${assigneeMember.lastName}` : '';
              
              return (
                <div 
                  key={task.id}
                  className="task-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="task-header">
                    <div className="task-title-wrapper">
                      <span className={`task-status-dot task-status-dot--in-progress`} aria-hidden="true"></span>
                      <h4 
                        className="task-title"
                        onClick={(e) => handleTaskClick(task, e)}
                      >
                        {task.description}
                      </h4>
                    </div>
                    <div className="task-assignee-avatar">
                      {task.assigneeId ? (
                        <div 
                          className="assignee-avatar-initials" 
                          title={assigneeFullName}
                          onClick={(e) => handleAssignClick(task, e)}
                        >
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
              );
            })}
            {getTasksByStatus(1).length === 0 && (
              <div className="empty-column-message">
                No tasks in this column
              </div>
            )}
          </div>
        </div>

        {/* Completed Column */}
        <div className="board-column">
          <div className="board-column-header">
            <h3>Completed</h3>
            <div className="task-count">{getTasksByStatus(2).length}</div>
          </div>
          
          <div 
            ref={columnRefs.completed}
            className="board-column-content"
            onDragOver={(e) => handleDragOver(e, 'completed')}
            onDragLeave={(e) => handleDragLeave(e, 'completed')}
            onDrop={(e) => handleDrop(e, 2)}
          >
            {getTasksByStatus(2).map((task: Task) => {
              const assigneeMember = task.assigneeId ? members.find(m => m.id === task.assigneeId) : null;
              const assigneeFullName = assigneeMember ? `${assigneeMember.firstName} ${assigneeMember.lastName}` : '';
              
              return (
                <div 
                  key={task.id}
                  className="task-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="task-header">
                    <div className="task-title-wrapper">
                      <span className={`task-status-dot task-status-dot--completed`} aria-hidden="true"></span>
                      <h4 
                        className="task-title"
                        onClick={(e) => handleTaskClick(task, e)}
                      >
                        {task.description}
                      </h4>
                    </div>
                    <div className="task-assignee-avatar">
                      {task.assigneeId ? (
                        <div 
                          className="assignee-avatar-initials" 
                          title={assigneeFullName}
                          onClick={(e) => handleAssignClick(task, e)}
                        >
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
              );
            })}
            {getTasksByStatus(2).length === 0 && (
              <div className="empty-column-message">
                No tasks in this column
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Mobile Drop Zones - Appears when dragging on mobile */}
      {isMobile && showMobileDropZones && dropZonePosition && (
        <div 
          className="mobile-drop-zones"
          style={{
            position: 'fixed',
            top: `${dropZonePosition.top}px`,
            left: `${dropZonePosition.left}px`,
            zIndex: 1001
          }}
        >
          <button
            className="mobile-drop-zone mobile-drop-zone--todo"
            onClick={() => handleMobileDrop(0)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('drag-over');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('drag-over');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              handleMobileDrop(0);
            }}
          >
            To Do
          </button>
          <button
            className="mobile-drop-zone mobile-drop-zone--in-progress"
            onClick={() => handleMobileDrop(1)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('drag-over');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('drag-over');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              handleMobileDrop(1);
            }}
          >
            In Progress
          </button>
          <button
            className="mobile-drop-zone mobile-drop-zone--completed"
            onClick={() => handleMobileDrop(2)}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('drag-over');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('drag-over');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              handleMobileDrop(2);
            }}
          >
            Completed
          </button>
        </div>
      )}

      {/* TaskInspector */}
      <TaskInspector
        task={selectedTaskForEdit}
        isOpen={inspectorOpen}
        onClose={() => {
          setInspectorOpen(false);
          setSelectedTaskForEdit(null);
        }}
        onUpdate={(updatedTask: Task) => {
          // Update selectedTaskForEdit to reflect changes
          if (selectedTaskForEdit?.id === updatedTask.id) {
            setSelectedTaskForEdit(updatedTask);
          }
        }}
        members={members}
        onStatusChange={handleStatusChangeFromInspector}
        onAssigneeChange={handleAssigneeChangeFromInspector}
        onDescriptionUpdate={handleDescriptionUpdate}
      />
    </div>
  );
};

export default Board;

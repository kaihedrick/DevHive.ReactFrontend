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

  // Layout and input device detection (separated)
  const [isNarrow, setIsNarrow] = useState<boolean>(false);
  const [usePointerDnD, setUsePointerDnD] = useState<boolean>(false);
  
  // Mobile drag-and-drop state
  const [draggedTaskElement, setDraggedTaskElement] = useState<HTMLElement | null>(null);
  const [showMobileDropZones, setShowMobileDropZones] = useState<boolean>(false);
  const [dropZonePosition, setDropZonePosition] = useState<{ top: number; left: number } | null>(null);
  const draggedTaskRef = useRef<HTMLElement | null>(null);

  // Pointer-based drag state for touch devices
  type DragState =
    | { mode: 'idle' }
    | { mode: 'pending'; task: Task; startX: number; startY: number; pointerId: number }
    | { mode: 'dragging'; task: Task; pointerId: number; offsetX: number; offsetY: number; ghost: HTMLElement; sourceCard: HTMLElement };

  const [pointerDrag, setPointerDrag] = useState<DragState>({ mode: 'idle' });
  const highlightedColumnRef = useRef<HTMLElement | null>(null);
  const highlightedDropZoneRef = useRef<HTMLElement | null>(null);
  const pointerDragRef = useRef<DragState>({ mode: 'idle' });
  const longPressRef = useRef<number | null>(null);
  const scrollLockRef = useRef<{ y: number } | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    pointerDragRef.current = pointerDrag;
  }, [pointerDrag]);

  // Detect pointer type (coarse = touch, fine = mouse)
  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)');
    const update = () => setUsePointerDnD(mql.matches);
    update();
    
    // Modern browsers support addEventListener on MediaQueryList
    if (mql.addEventListener) {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    } else {
      // Fallback for older browsers
      mql.addListener(update);
      return () => mql.removeListener(update);
    }
  }, []);

  // Detect narrow layout (for styling purposes)
  useEffect(() => {
    const checkNarrow = () => {
      setIsNarrow(window.innerWidth <= 768);
    };
    
    checkNarrow();
    window.addEventListener('resize', checkNarrow);
    return () => window.removeEventListener('resize', checkNarrow);
  }, []);

  // Document-level pointer handlers for dragging
  useEffect(() => {
    if (pointerDrag.mode === 'dragging') {
      const handleDocumentPointerMove = (e: PointerEvent): void => {
        const current = pointerDragRef.current;
        if (current.mode === 'dragging') {
          e.preventDefault(); // Critical: prevent iOS scroll gestures
          
          current.ghost.style.left = `${e.clientX - current.offsetX}px`;
          current.ghost.style.top = `${e.clientY - current.offsetY}px`;

          // Highlight drop target (prioritize drop zones over columns)
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const dropZone = el?.closest('.mobile-drop-zone') as HTMLElement | null;
          const col = el?.closest('[data-status]') as HTMLElement | null;
          
          if (dropZone && dropZone !== highlightedDropZoneRef.current) {
            // Highlight drop zone
            clearHighlightedColumns();
            clearHighlightedDropZones();
            dropZone.classList.add('drag-over');
            highlightedDropZoneRef.current = dropZone;
          } else if (!dropZone && col && col !== highlightedColumnRef.current) {
            // Highlight column if not over drop zone
            clearHighlightedDropZones();
            clearHighlightedColumns();
            col.classList.add('drag-over');
            highlightedColumnRef.current = col;
          } else if (!dropZone && !col) {
            // Clear all highlights if not over any target
            clearHighlightedColumns();
            clearHighlightedDropZones();
          }
        }
      };

      const handleDocumentPointerUp = async (e: PointerEvent): Promise<void> => {
        const current = pointerDragRef.current;
        if (current.mode === 'dragging') {
          // Check what we're dropping on (prioritize drop zones)
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const dropZone = el?.closest('.mobile-drop-zone') as HTMLElement | null;
          const col = el?.closest('[data-status]') as HTMLElement | null;
          
          let newStatus: number | null = null;
          
          if (dropZone) {
            // Dropped on mobile drop zone - automatically drop
            const statusClass = dropZone.className;
            if (statusClass.includes('todo')) newStatus = 0;
            else if (statusClass.includes('in-progress')) newStatus = 1;
            else if (statusClass.includes('completed')) newStatus = 2;
          } else if (col) {
            // Dropped on column
            newStatus = Number(col.dataset.status);
          }

          cleanupPointerDrag(current);
          clearHighlightedDropZones();
          setShowMobileDropZones(false);
          setDropZonePosition(null);
          setDraggedTask(null);

          if (newStatus !== null && newStatus !== current.task.status) {
            const success = await handleStatusUpdate(current.task.id, newStatus);
            if (success) {
              setSuccessMessage(`Task moved to ${newStatus === 0 ? 'To Do' : newStatus === 1 ? 'In Progress' : 'Completed'}`);
            }
          }
        }
      };

      const handleDocumentPointerCancel = (): void => {
        const current = pointerDragRef.current;
        cleanupPointerDrag(current);
        clearHighlightedDropZones();
      };

      // Touch move blocker for iOS (sometimes more reliable than pointermove)
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 1) return; // Allow pinch zoom
        e.preventDefault();
      };

      document.addEventListener('pointermove', handleDocumentPointerMove, { passive: false });
      document.addEventListener('pointerup', handleDocumentPointerUp);
      document.addEventListener('pointercancel', handleDocumentPointerCancel);
      document.addEventListener('touchmove', onTouchMove, { passive: false });

      return () => {
        document.removeEventListener('pointermove', handleDocumentPointerMove);
        document.removeEventListener('pointerup', handleDocumentPointerUp);
        document.removeEventListener('pointercancel', handleDocumentPointerCancel);
        document.removeEventListener('touchmove', onTouchMove);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointerDrag.mode === 'dragging']);

  // Cleanup pointer drag on unmount
  useEffect(() => {
    return () => {
        setPointerDrag((current) => {
        if (current.mode === 'dragging') {
          current.ghost.remove();
          current.sourceCard.classList.remove('drag-source');
          document.body.classList.remove('dragging-task');
          unlockScroll();
          // Clear highlighted columns on unmount
          Object.values(columnRefs).forEach(ref => {
            if (ref.current) {
              ref.current.classList.remove('drag-over');
            }
          });
        }
        return { mode: 'idle' };
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSelectedTaskForEdit({ ...task, assigneeId: newAssigneeId || undefined });
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
    
    // Show drop zones for touch devices
    if (usePointerDnD) {
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
    
    // Hide drop zones for touch devices
    if (usePointerDnD) {
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
      
      // Hide drop zones after successful drop
      if (usePointerDnD) {
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

  // Pointer-based drag handlers for touch devices
  const LONG_PRESS_MS = 150;
  const MOVE_CANCEL_PX = 8;

  const clearHighlightedColumns = (): void => {
    Object.values(columnRefs).forEach(ref => {
      if (ref.current) {
        ref.current.classList.remove('drag-over');
      }
    });
    highlightedColumnRef.current = null;
  };

  const clearHighlightedDropZones = (): void => {
    document.querySelectorAll('.mobile-drop-zone').forEach(zone => {
      zone.classList.remove('drag-over');
    });
    highlightedDropZoneRef.current = null;
  };

  const lockScroll = (): void => {
    if (scrollLockRef.current) return;
    const y = window.scrollY;
    scrollLockRef.current = { y };

    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  };

  const unlockScroll = (): void => {
    const state = scrollLockRef.current;
    if (!state) return;

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, state.y);

    scrollLockRef.current = null;
  };

  const startDrag = (card: HTMLElement, task: Task, pointerId: number, startX: number, startY: number): void => {
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.classList.add('drag-ghost');
    document.body.appendChild(ghost);

    card.classList.add('drag-source');
    try {
      card.setPointerCapture(pointerId);
    } catch (err) {
      console.warn('setPointerCapture failed:', err);
    }
    
    // Lock scroll and add dragging class
    lockScroll();
    document.body.classList.add('dragging-task');

    const newDragState: DragState = {
      mode: 'dragging',
      task,
      pointerId,
      offsetX: startX - rect.left,
      offsetY: startY - rect.top,
      ghost,
      sourceCard: card
    };

    setPointerDrag(newDragState);

    // Show mobile drop zones
    const dropZoneWidth = Math.min(400, window.innerWidth - 32);
    const taskCenter = rect.left + (rect.width / 2);
    const dropZoneLeft = Math.max(16, Math.min(taskCenter - (dropZoneWidth / 2), window.innerWidth - dropZoneWidth - 16));
    
    setDropZonePosition({
      top: rect.bottom + 8,
      left: dropZoneLeft
    });
    setShowMobileDropZones(true);
    setDraggedTask(task);
  };

  const cleanupPointerDrag = (dragState?: DragState): void => {
    const state = dragState || pointerDrag;
    if (state.mode === 'dragging') {
      state.ghost.remove();
      state.sourceCard.classList.remove('drag-source');
      document.body.classList.remove('dragging-task');
      unlockScroll();
      clearHighlightedColumns();
      clearHighlightedDropZones();
    }
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    setPointerDrag({ mode: 'idle' });
  };

  const handlePointerDown = (e: React.PointerEvent, task: Task): void => {
    if (!usePointerDnD) return;
    
    e.stopPropagation();
    // Don't preventDefault here - only lock scroll when drag actually starts
    
    const card = (e.currentTarget as HTMLElement).closest('.task-card') as HTMLElement | null;
    if (!card) return;

    setPointerDrag({
      mode: 'pending',
      task,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId
    });

    // Start long-press timer
    longPressRef.current = window.setTimeout(() => {
      const current = pointerDragRef.current;
      if (current.mode === 'pending' && current.task.id === task.id) {
        startDrag(card, task, current.pointerId, current.startX, current.startY);
      }
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent): void => {
    const current = pointerDragRef.current;
    if (current.mode === 'pending') {
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      const distance = Math.hypot(dx, dy);

      // If user moves too much, cancel the long-press (they're scrolling)
      if (distance > MOVE_CANCEL_PX) {
        if (longPressRef.current) {
          window.clearTimeout(longPressRef.current);
          longPressRef.current = null;
        }
        setPointerDrag({ mode: 'idle' });
      }
    }
    // Note: dragging mode is handled by document-level listeners
  };

  const handlePointerUp = (e: React.PointerEvent): void => {
    // Cancel long-press if still pending
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    
    // Only handle if still in pending mode (didn't start dragging)
    const current = pointerDragRef.current;
    if (current.mode === 'pending') {
      setPointerDrag({ mode: 'idle' });
    }
    // Dragging mode is handled by document-level pointerup listener
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
            data-status="0"
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
                  draggable={!usePointerDnD}
                  onDragStart={!usePointerDnD ? (e) => handleDragStart(e, task) : undefined}
                  onDragEnd={!usePointerDnD ? handleDragEnd : undefined}
                  onPointerDown={usePointerDnD ? (e) => handlePointerDown(e, task) : undefined}
                  onPointerMove={usePointerDnD ? handlePointerMove : undefined}
                  onPointerUp={usePointerDnD ? handlePointerUp : undefined}
                  onPointerCancel={usePointerDnD ? () => cleanupPointerDrag() : undefined}
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
            data-status="1"
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
                  draggable={!usePointerDnD}
                  onDragStart={!usePointerDnD ? (e) => handleDragStart(e, task) : undefined}
                  onDragEnd={!usePointerDnD ? handleDragEnd : undefined}
                  onPointerDown={usePointerDnD ? (e) => handlePointerDown(e, task) : undefined}
                  onPointerMove={usePointerDnD ? handlePointerMove : undefined}
                  onPointerUp={usePointerDnD ? handlePointerUp : undefined}
                  onPointerCancel={usePointerDnD ? () => cleanupPointerDrag() : undefined}
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
            data-status="2"
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
                  draggable={!usePointerDnD}
                  onDragStart={!usePointerDnD ? (e) => handleDragStart(e, task) : undefined}
                  onDragEnd={!usePointerDnD ? handleDragEnd : undefined}
                  onPointerDown={usePointerDnD ? (e) => handlePointerDown(e, task) : undefined}
                  onPointerMove={usePointerDnD ? handlePointerMove : undefined}
                  onPointerUp={usePointerDnD ? handlePointerUp : undefined}
                  onPointerCancel={usePointerDnD ? () => cleanupPointerDrag() : undefined}
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

      {/* Mobile Drop Zones - Appears when dragging on touch devices */}
      {usePointerDnD && showMobileDropZones && dropZonePosition && (
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
            data-status="0"
          >
            To Do
          </button>
          <button
            className="mobile-drop-zone mobile-drop-zone--in-progress"
            onClick={() => handleMobileDrop(1)}
            data-status="1"
          >
            In Progress
          </button>
          <button
            className="mobile-drop-zone mobile-drop-zone--completed"
            onClick={() => handleMobileDrop(2)}
            data-status="2"
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

import React, { useState, useEffect, useRef } from 'react';
import { fetchProjectSprints } from '../services/sprintService';
import { fetchSprintTasks, updateTaskStatus } from '../services/taskService';
import { getSelectedProject } from '../services/storageService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCalendarAlt, faBars } from '@fortawesome/free-solid-svg-icons';
import '../styles/board.css';

const Board = () => {
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const projectId = getSelectedProject();
  
  const columnRefs = {
    todo: useRef(null),
    inProgress: useRef(null),
    completed: useRef(null)
  };

  // Fetch sprints on component mount
  useEffect(() => {
    if (!projectId) {
      setError("No project selected. Please select a project first.");
      setLoading(false);
      return;
    }

    const loadSprints = async () => {
      try {
        setLoading(true);
        const fetchedSprints = await fetchProjectSprints(projectId);
        setSprints(fetchedSprints || []);
        
        // Set the first sprint as selected by default if available
        if (fetchedSprints && fetchedSprints.length > 0) {
          setSelectedSprint(fetchedSprints[0].id);
          await loadTasks(fetchedSprints[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError("Failed to load sprints: " + err.message);
        setLoading(false);
      }
    };

    loadSprints();
  }, [projectId]);

  // Load tasks when selected sprint changes
  const loadTasks = async (sprintId) => {
    if (!sprintId) return;
    
    try {
      setLoading(true);
      const fetchedTasks = await fetchSprintTasks(sprintId);
      
      setTasks(fetchedTasks || []);
      setLoading(false);
    } catch (err) {
      setError("Failed to load tasks: " + err.message);
      setLoading(false);
    }
  };

  // Handle sprint selection change
  const handleSprintChange = async (e) => {
    const sprintId = e.target.value;
    setSelectedSprint(sprintId);
    await loadTasks(sprintId);
  };

  // Filter tasks by status
  const getTasksByStatus = (status) => {
    return tasks.filter(task => task.status === status);
  };

  // Drag handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a ghost image of the task card
    const ghostElement = e.target.cloneNode(true);
    ghostElement.id = 'drag-ghost';
    ghostElement.style.position = 'absolute';
    ghostElement.style.top = '-1000px';
    ghostElement.style.opacity = '0';
    document.body.appendChild(ghostElement);
    
    e.dataTransfer.setDragImage(ghostElement, 20, 20);
    
    // Add a class to the dragged element
    e.target.classList.add('dragging');
    
    // Required for Firefox
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    
    // Remove the ghost element
    const ghostElement = document.getElementById('drag-ghost');
    if (ghostElement) {
      ghostElement.remove();
    }
    
    // Remove all highlighting
    Object.values(columnRefs).forEach(ref => {
      if (ref.current) {
        ref.current.classList.remove('highlight-drop-target');
      }
    });
  };

  const handleDragOver = (e, columnName) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Highlight current column
    const columnRef = columnRefs[columnName];
    if (columnRef && columnRef.current) {
      columnRef.current.classList.add('highlight-drop-target');
    }
    
    // Remove highlight from other columns
    Object.entries(columnRefs).forEach(([name, ref]) => {
      if (name !== columnName && ref.current) {
        ref.current.classList.remove('highlight-drop-target');
      }
    });
  };

  const handleDragLeave = (e, columnName) => {
    const columnRef = columnRefs[columnName];
    if (columnRef && columnRef.current) {
      columnRef.current.classList.remove('highlight-drop-target');
    }
  };

  const handleDrop = async (e, statusValue) => {
    e.preventDefault();
    
    // Reset highlighting
    Object.values(columnRefs).forEach(ref => {
      if (ref.current) {
        ref.current.classList.remove('highlight-drop-target');
      }
    });
    
    if (!draggedTask) return;
    
    // If the task is already in this column, do nothing
    if (draggedTask.status === statusValue) return;
    
    try {
      // Update task status in the backend
      await updateTaskStatus(draggedTask.id, statusValue);
      
      // Update task status in the state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === draggedTask.id 
            ? { ...task, status: statusValue } 
            : task
        )
      );
      
      // Show success message
      const statusText = statusValue === 0 ? 'To Do' : statusValue === 1 ? 'In Progress' : 'Completed';
      setSuccessMessage(`Task moved to ${statusText}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(`Failed to update task status: ${err.message}`);
      setTimeout(() => setError(null), 3000);
    }
    
    setDraggedTask(null);
  };

  // Format date from ISO string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Get initials from user name
  const getInitials = (firstName, lastName) => {
    return firstName && lastName 
      ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
      : 'NA';
  };

  if (!projectId) {
    return (
      <div className="board-page">
        <div className="board-container">
          <div className="error-message">
            No project selected. Please select a project first.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="board-page">
      <div className="board-container">
        <div className="board-header">
          <h2 className="board-title">Project Board</h2>
          
          <div className="sprint-selector">
            <label htmlFor="sprint-select">Select Sprint:</label>
            <select 
              id="sprint-select" 
              value={selectedSprint || ''}
              onChange={handleSprintChange}
              disabled={loading || sprints.length === 0}
            >
              {sprints.length === 0 ? (
                <option value="">No sprints available</option>
              ) : (
                sprints.map(sprint => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-message">Loading board...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : !selectedSprint ? (
          <div className="info-message">Please select a sprint to view tasks.</div>
        ) : (
          <div className="board-columns">
            {/* To Do Column */}
            <div className="board-column-wrapper">
              <div className="board-column">
                <div className="board-column-header">
                  <h3>To Do</h3>
                  <div className="task-count">{getTasksByStatus(0).length}</div>
                </div>
                
                <div 
                  className="task-list"
                  ref={columnRefs.todo}
                  onDragOver={(e) => handleDragOver(e, 'todo')}
                  onDragLeave={(e) => handleDragLeave(e, 'todo')}
                  onDrop={(e) => handleDrop(e, 0)}
                >
                  {getTasksByStatus(0).map(task => (
                    <div 
                      key={task.id}
                      className="task-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="task-header">
                        <div className="task-title">{task.description}</div>
                        <div className="task-actions">
                          <FontAwesomeIcon icon={faBars} />
                        </div>
                      </div>
                      <div className="task-content">
                        <div className="task-meta">
                          <div className="task-assignee">
                            <FontAwesomeIcon icon={faUser} />
                            <span>{getInitials(task.assigneeFirstName, task.assigneeLastName)}</span>
                          </div>
                          <div className="task-date">
                            <FontAwesomeIcon icon={faCalendarAlt} />
                            <span>{formatDate(task.dateCreated)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getTasksByStatus(0).length === 0 && (
                    <div className="empty-column-message">
                      No tasks in this column
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* In Progress Column */}
            <div className="board-column-wrapper">
              <div className="board-column">
                <div className="board-column-header">
                  <h3>In Progress</h3>
                  <div className="task-count">{getTasksByStatus(1).length}</div>
                </div>
                
                <div 
                  className="task-list"
                  ref={columnRefs.inProgress}
                  onDragOver={(e) => handleDragOver(e, 'inProgress')}
                  onDragLeave={(e) => handleDragLeave(e, 'inProgress')}
                  onDrop={(e) => handleDrop(e, 1)}
                >
                  {getTasksByStatus(1).map(task => (
                    <div 
                      key={task.id}
                      className="task-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="task-header">
                        <div className="task-title">{task.description}</div>
                        <div className="task-actions">
                          <FontAwesomeIcon icon={faBars} />
                        </div>
                      </div>
                      <div className="task-content">
                        <div className="task-meta">
                          <div className="task-assignee">
                            <FontAwesomeIcon icon={faUser} />
                            <span>{getInitials(task.assigneeFirstName, task.assigneeLastName)}</span>
                          </div>
                          <div className="task-date">
                            <FontAwesomeIcon icon={faCalendarAlt} />
                            <span>{formatDate(task.dateCreated)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getTasksByStatus(1).length === 0 && (
                    <div className="empty-column-message">
                      No tasks in this column
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Completed Column */}
            <div className="board-column-wrapper">
              <div className="board-column">
                <div className="board-column-header">
                  <h3>Completed</h3>
                  <div className="task-count">{getTasksByStatus(3).length}</div>
                </div>
                
                <div 
                  className="task-list"
                  ref={columnRefs.completed}
                  onDragOver={(e) => handleDragOver(e, 'completed')}
                  onDragLeave={(e) => handleDragLeave(e, 'completed')}
                  onDrop={(e) => handleDrop(e, 3)}
                >
                  {getTasksByStatus(3).map(task => (
                    <div 
                      key={task.id}
                      className="task-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="task-header">
                        <div className="task-title">{task.description}</div>
                        <div className="task-actions">
                          <FontAwesomeIcon icon={faBars} />
                        </div>
                      </div>
                      <div className="task-content">
                        <div className="task-meta">
                          <div className="task-assignee">
                            <FontAwesomeIcon icon={faUser} />
                            <span>{getInitials(task.assigneeFirstName, task.assigneeLastName)}</span>
                          </div>
                          <div className="task-date">
                            <FontAwesomeIcon icon={faCalendarAlt} />
                            <span>{formatDate(task.dateCreated)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getTasksByStatus(3).length === 0 && (
                    <div className="empty-column-message">
                      No tasks in this column
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Board;

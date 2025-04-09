import React, { useRef, useState, useEffect } from 'react';
import { getSelectedProject } from '../services/storageService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faBars } from '@fortawesome/free-solid-svg-icons';
import useBoardActions from '../hooks/useBoardActions';
import '../styles/board.css';

const Board = () => {
  const projectId = getSelectedProject();
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
  } = useBoardActions(projectId);

  const columnRefs = {
    todo: useRef(null),
    inProgress: useRef(null),
    completed: useRef(null)
  };

  const [localSuccessMessage, setLocalSuccessMessage] = useState('');
  const [localErrorMessage, setLocalErrorMessage] = useState('');

  // Automatically clear success and error messages after 3 seconds
  useEffect(() => {
    if (successMessage) {
      setLocalSuccessMessage(successMessage);
      setTimeout(() => setLocalSuccessMessage(''), 3000);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      setLocalErrorMessage(error);
      setTimeout(() => setLocalErrorMessage(''), 3000);
    }
  }, [error]);

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
    Object.values(columnRefs).forEach((ref) => {
      if (ref.current) {
        ref.current.classList.remove("highlight-drop-target");
      }
    });

    if (!draggedTask) return;

    // If the task is already in this column, do nothing
    if (draggedTask.status === statusValue) return;

    await handleStatusUpdate(draggedTask.id, statusValue);
    setDraggedTask(null);
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
        {/* Success and Error Pop-Ups */}
        {localSuccessMessage && (
          <div className="success-popup">{localSuccessMessage}</div>
        )}
        {localErrorMessage && (
          <div className="error-popup">{localErrorMessage}</div>
        )}

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
                          <div className="task-assignee dropdown">
                            {/* Dropdown to show full names */}
                            <select
                              className="task-assignee-dropdown"
                              value={task.assigneeID || ""}
                              onChange={(e) => handleAssigneeChange(task, e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.firstName} {member.lastName}
                                </option>
                              ))}
                            </select>
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
                          <div className="task-assignee dropdown">
                            {/* Dropdown to show full names */}
                            <select
                              className="task-assignee-dropdown"
                              value={task.assigneeID || ""}
                              onChange={(e) => handleAssigneeChange(task, e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.firstName} {member.lastName}
                                </option>
                              ))}
                            </select>
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
                  <div className="task-count">{getTasksByStatus(2).length}</div>
                </div>
                
                <div 
                  className="task-list"
                  ref={columnRefs.completed}
                  onDragOver={(e) => handleDragOver(e, 'completed')}
                  onDragLeave={(e) => handleDragLeave(e, 'completed')}
                  onDrop={(e) => handleDrop(e, 2)}
                >
                  {getTasksByStatus(2).map(task => (
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
                          <div className="task-assignee dropdown">
                            {/* Dropdown to show full names */}
                            <select
                              className="task-assignee-dropdown"
                              value={task.assigneeID || ""}
                              onChange={(e) => handleAssigneeChange(task, e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.firstName} {member.lastName}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="task-date">
                            <FontAwesomeIcon icon={faCalendarAlt} />
                            <span>{formatDate(task.dateCreated)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {getTasksByStatus(2).length === 0 && (
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

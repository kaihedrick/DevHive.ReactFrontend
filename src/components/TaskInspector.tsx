import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { Task, User } from '../types/hooks.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { isValidText } from '../utils/validation.ts';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea.ts';
import '../styles/task_inspector.css';
import '../styles/project_details.css'; // For char-count styling

interface TaskInspectorProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  members: User[];
  onStatusChange: (task: Task, newStatus: number) => Promise<void>;
  onAssigneeChange: (task: Task, newAssigneeId: string) => Promise<void>;
  onDescriptionUpdate: (taskId: string, description: string) => Promise<void>;
}

/**
 * TaskInspector Component
 * 
 * Right-side inspector panel for editing task details.
 * Apple-style design with slide-in animation.
 */
const TaskInspector: React.FC<TaskInspectorProps> = ({
  task,
  isOpen,
  onClose,
  onUpdate,
  members,
  onStatusChange,
  onAssigneeChange,
  onDescriptionUpdate,
}) => {
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<number>(0);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const { showError } = useToast();
  
  // Auto-resize textarea for description
  const descriptionTextareaRef = useAutoResizeTextarea(description, 4);

  // Update local state when task changes
  useEffect(() => {
    if (task) {
      setDescription(task.description || '');
      setStatus(task.status);
      setAssigneeId(task.assigneeId || '');
    } else {
      // Reset form when task is cleared
      setDescription('');
      setStatus(0);
      setAssigneeId('');
    }
  }, [task?.id, task?.description, task?.status, task?.assigneeId]);

  // Lock scroll while inspector is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  const handleSave = async (): Promise<void> => {
    if (!task) return;

    setIsSaving(true);
    try {
      const updates: Promise<void>[] = [];

      // Update description if changed
      if (description !== task.description) {
        updates.push(onDescriptionUpdate(task.id, description));
      }

      // Update status if changed
      if (status !== task.status) {
        updates.push(onStatusChange(task, status));
      }

      // Update assignee if changed
      if (assigneeId !== (task.assigneeId || '')) {
        updates.push(onAssigneeChange(task, assigneeId));
      }

      // Wait for all updates to complete
      await Promise.all(updates);

      // Update local task state after all API calls complete
      const updatedTask: Task = {
        ...task,
        description,
        status,
        assigneeId: assigneeId || null,
      };
      onUpdate(updatedTask);
      
      // Small delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      // Don't close on error - let user see the error and retry
    } finally {
      setIsSaving(false);
    }
  };

  if (!task || !isOpen) return null;

  const target = document.getElementById('modal-root') ?? document.body;

  const inspectorContent = (
    <div 
      className="task-inspector-backdrop is-open"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Inspector Panel */}
      <div 
        className="task-inspector is-open"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="task-inspector-content">
          {/* Header */}
          <header className="task-inspector-header">
            <h2 className="task-inspector-title">Task Details</h2>
            <button
              className="task-inspector-close"
              onClick={onClose}
              aria-label="Close inspector"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </header>

          {/* Body */}
          <div className="task-inspector-body">
            {/* Description */}
            <div className="inspector-field">
              <label htmlFor="task-description" className="inspector-label">
                Description
              </label>
              <textarea
                ref={descriptionTextareaRef}
                id="task-description"
                className="inspector-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Enter task description..."
                maxLength={255}
                style={{ resize: 'none', overflow: 'hidden' }}
              />
              <div className="char-count">{description.length}/255</div>
            </div>

            {/* Status */}
            <div className="inspector-field">
              <label htmlFor="task-status" className="inspector-label">
                Status
              </label>
              <select
                id="task-status"
                className="inspector-select"
                value={status}
                onChange={(e) => setStatus(parseInt(e.target.value))}
              >
                <option value={0}>To Do</option>
                <option value={1}>In Progress</option>
                <option value={2}>Completed</option>
              </select>
            </div>

            {/* Assignee */}
            <div className="inspector-field">
              <label htmlFor="task-assignee" className="inspector-label">
                Assignee
              </label>
              <select
                id="task-assignee"
                className="inspector-select"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((member: User) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <footer className="task-inspector-footer">
            <button
              className="inspector-btn inspector-btn--secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="inspector-btn inspector-btn--primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );

  return createPortal(inspectorContent, target);
};

export default TaskInspector;


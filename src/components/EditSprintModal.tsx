import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { updateSprint, deleteSprint } from '../services/sprintService';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea.ts';
import '../styles/modal.css';

interface Sprint {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

interface EditSprintModalProps {
  sprint: Sprint;
  projectId: string;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export default function EditSprintModal({ sprint, projectId, onClose, onUpdated, onDeleted }: EditSprintModalProps) {
  console.log('EditSprintModal rendered with sprint:', sprint?.name, 'projectId:', projectId);
  
  const [name, setName] = useState(sprint.name ?? '');
  const [desc, setDesc] = useState(sprint.description ?? '');
  const [start, setStart] = useState(sprint.startDate?.slice(0, 10) ?? '');
  const [end, setEnd] = useState(sprint.endDate?.slice(0, 10) ?? '');
  const [busy, setBusy] = useState(false);
  
  // Auto-resize textarea for description
  const descriptionTextareaRef = useAutoResizeTextarea(desc, 3);

  // Lock scroll while modal is open (prevents background scroll on iOS)
  useEffect(() => {
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      document.body.classList.remove('modal-open');
    };
  }, []);

  async function save() {
    try {
      setBusy(true);
      await updateSprint(sprint.id, {
        name,
        description: desc,
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
      });
      onUpdated();
    } catch (error) {
      console.error('Error updating sprint:', error);
      alert('Failed to update sprint. Please try again.');
    } finally { 
      setBusy(false); 
    }
  }

  async function remove() {
    if (!window.confirm(`Delete sprint "${sprint.name}"? This cannot be undone.`)) return;
    try {
      setBusy(true);
      await deleteSprint(sprint.id);
      onDeleted();
    } catch (error) {
      console.error('Error deleting sprint:', error);
      alert('Failed to delete sprint. Please try again.');
    } finally { 
      setBusy(false); 
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const target = document.getElementById('modal-root') ?? document.body;
  console.log('Modal target:', target, 'target id:', target.id || 'body');
  
  const modalContent = (
    <div 
      className="modal is-open" 
      role="dialog" 
      aria-modal="true" 
      aria-label={`Edit ${sprint.name}`}
      onKeyDown={handleKeyDown}
    >
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__card">
        {/* Header with close button */}
        <header className="modal__header">
          <button 
            className="icon-btn" 
            aria-label="Close" 
            onClick={onClose}
            type="button"
          >
            <FontAwesomeIcon icon={faTimes} className="icon" aria-hidden="true" />
          </button>
          <h3 className="modal__title">Edit Sprint</h3>
        </header>

        {/* Body with form fields */}
        <div className="modal__body">
          <label htmlFor="edit-sprint-name">
            <span>Name</span>
            <input 
              id="edit-sprint-name"
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              className="form-input"
            />
          </label>

          <label htmlFor="edit-sprint-desc">
            <span>Description</span>
            <textarea 
              ref={descriptionTextareaRef}
              id="edit-sprint-desc"
              value={desc} 
              onChange={(e) => setDesc(e.target.value)}
              disabled={busy}
              rows={3}
              className="form-input"
              style={{ resize: 'none', overflow: 'hidden' }}
            />
          </label>

          <div className="grid grid--2">
            <label htmlFor="edit-sprint-start">
              <span>Start Date</span>
              <input 
                id="edit-sprint-start"
                type="date" 
                value={start} 
                onChange={(e) => setStart(e.target.value)}
                disabled={busy}
                className="form-input"
              />
            </label>
            <label htmlFor="edit-sprint-end">
              <span>End Date</span>
              <input 
                id="edit-sprint-end"
                type="date" 
                value={end} 
                onChange={(e) => setEnd(e.target.value)}
                disabled={busy}
                className="form-input"
              />
            </label>
          </div>
        </div>

        {/* Footer with action buttons */}
        <footer className="modal__footer">
          <div className="form-actions">
            <button 
              className="secondary-action-btn" 
              onClick={onClose} 
              disabled={busy}
              type="button"
            >
              Cancel
            </button>
            <button 
              className="danger-action-btn" 
              onClick={remove} 
              disabled={busy}
              type="button"
            >
              Delete
            </button>
            <button 
              className="primary-action-btn" 
              onClick={save} 
              disabled={busy}
              type="button"
            >
              Save
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(modalContent, target);
}

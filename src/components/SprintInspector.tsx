import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { useUpdateSprint, useDeleteSprint } from '../hooks/useSprints.ts';
import { Sprint } from '../types/hooks.ts';
import ConfirmationModal from './ConfirmationModal.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { isValidText, isValidDateRange, isEndDateAfterStartDate } from '../utils/validation.ts';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea.ts';
import '../styles/sprint_inspector.css';
import '../styles/project_details.css'; // For char-count styling

interface SprintInspectorProps {
  sprint: Sprint | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

/**
 * SprintInspector Component
 * 
 * Right-side inspector panel for editing sprint details.
 * Apple-style design with slide-in animation.
 */
const SprintInspector: React.FC<SprintInspectorProps> = ({
  sprint,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const { showSuccess, showError } = useToast();

  const updateSprintMutation = useUpdateSprint();
  const deleteSprintMutation = useDeleteSprint();
  
  // Calculate max date (1 year from today)
  const maxDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  }, []);
  
  const today = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Update local state when sprint changes
  useEffect(() => {
    if (sprint) {
      setName(sprint.name || '');
      setDescription(sprint.description || '');
      // Convert ISO date strings to YYYY-MM-DD format for date inputs
      if (sprint.startDate) {
        setStartDate(sprint.startDate.split('T')[0]);
      }
      if (sprint.endDate) {
        setEndDate(sprint.endDate.split('T')[0]);
      }
      setIsStarted(sprint.isStarted || false);
    } else {
      // Reset form when sprint is cleared
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setIsStarted(false);
    }
  }, [sprint?.id, sprint?.name, sprint?.description, sprint?.startDate, sprint?.endDate, sprint?.isStarted]);

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
    if (!sprint) return;

    // Validate name is not empty
    if (!name.trim()) {
      showError('Sprint name is required');
      return;
    }
    
    // Validate character restrictions
    if (!isValidText(name)) {
      showError('Sprint name contains invalid characters. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.');
      return;
    }
    
    if (description && !isValidText(description)) {
      showError('Description contains invalid characters. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.');
      return;
    }
    
    // Validate description length
    if (description.length > 255) {
      showError('Description cannot exceed 255 characters.');
      return;
    }

    // Validate dates
    if (!startDate || !endDate) {
      showError('Start date and end date are required');
      return;
    }
    
    // Validate date range (start date)
    if (!isValidDateRange(startDate, 1)) {
      const startDateObj = new Date(startDate);
      const todayObj = new Date();
      todayObj.setHours(0, 0, 0, 0);
      
      if (startDateObj < todayObj) {
        showError('Start date cannot be in the past.');
      } else {
        showError('Start date cannot be more than 1 year in the future.');
      }
      return;
    }
    
    // Validate date range (end date)
    if (!isValidDateRange(endDate, 1)) {
      const endDateObj = new Date(endDate);
      const todayObj = new Date();
      todayObj.setHours(0, 0, 0, 0);
      
      if (endDateObj < todayObj) {
        showError('End date cannot be in the past.');
      } else {
        showError('End date cannot be more than 1 year in the future.');
      }
      return;
    }

    // Validate end date is after start date
    if (!isEndDateAfterStartDate(startDate, endDate)) {
      showError('End date must be after start date');
      return;
    }

    setIsSaving(true);
    try {
      // Convert dates to ISO format for backend
      const isoStartDate = startDate ? new Date(startDate).toISOString() : '';
      const isoEndDate = endDate ? new Date(endDate).toISOString() : '';
      
      await updateSprintMutation.mutateAsync({
        sprintId: sprint.id,
        sprintData: {
          name: name.trim(),
          description: description.trim(),
          startDate: isoStartDate,
          endDate: isoEndDate,
          isStarted,
        },
      });
      
      showSuccess('Sprint updated successfully');
      onUpdate();
      
      // Small delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onClose();
    } catch (error: any) {
      console.error('Error saving sprint:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to update sprint';
      showError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = (): void => {
    // Only update local state - save will happen when user clicks Save button
    setIsStarted(!isStarted);
  };

  const handleDeleteClick = (): void => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!sprint) return;

    setShowDeleteConfirm(false);
    setIsSaving(true);
    try {
      await deleteSprintMutation.mutateAsync(sprint.id);
      showSuccess('Sprint deleted successfully');
      onDelete();
      
      // Small delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onClose();
    } catch (error: any) {
      console.error('Error deleting sprint:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to delete sprint';
      showError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCancel = (): void => {
    setShowDeleteConfirm(false);
  };

  if (!sprint || !isOpen) return null;

  const target = document.getElementById('modal-root') ?? document.body;

  const inspectorContent = (
    <div 
      className="sprint-inspector-backdrop is-open"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Inspector Panel */}
      <div 
        className="sprint-inspector is-open"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sprint-inspector-content">
          {/* Header */}
          <header className="sprint-inspector-header">
            <button
              className="sprint-inspector-back"
              onClick={onClose}
              aria-label="Back"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <h2 className="sprint-inspector-title">Sprint Details</h2>
            <div style={{ width: '32px' }} /> {/* Spacer for alignment */}
          </header>

          {/* Body */}
          <div className="sprint-inspector-body">
            {/* Name */}
            <div className="inspector-field">
              <label htmlFor="sprint-name" className="inspector-label">
                Name
              </label>
              <input
                id="sprint-name"
                type="text"
                className="inspector-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter sprint name..."
                disabled={isSaving}
              />
            </div>

            {/* Description */}
            <div className="inspector-field">
              <label htmlFor="sprint-description" className="inspector-label">
                Description
              </label>
              <textarea
                ref={descriptionTextareaRef}
                id="sprint-description"
                className="inspector-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Enter sprint description..."
                disabled={isSaving}
                maxLength={255}
                style={{ resize: 'none', overflow: 'hidden' }}
              />
              <div className="char-count">{description.length}/255</div>
            </div>

            {/* Start Date */}
            <div className="inspector-field">
              <label htmlFor="sprint-start-date" className="inspector-label">
                Start Date
              </label>
              <input
                id="sprint-start-date"
                type="date"
                className="inspector-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSaving}
                min={today}
                max={maxDate}
              />
            </div>

            {/* End Date */}
            <div className="inspector-field">
              <label htmlFor="sprint-end-date" className="inspector-label">
                End Date
              </label>
              <input
                id="sprint-end-date"
                type="date"
                className="inspector-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isSaving}
                min={startDate || today}
                max={maxDate}
              />
            </div>

            {/* Separator */}
            <div className="sprint-inspector-separator" />

            {/* Status Toggle */}
            <div className="inspector-field">
              <label className="inspector-label">Status</label>
              <div className="toggle-switch-container">
                <div className="toggle-switch-label">
                  <span className={!isStarted ? 'toggle-label-active' : 'toggle-label-inactive'}>
                    Inactive
                  </span>
                  <span className={isStarted ? 'toggle-label-active' : 'toggle-label-inactive'}>
                    Active
                  </span>
                </div>
                <button
                  type="button"
                  className={`toggle-switch ${isStarted ? 'toggle-switch--active' : ''}`}
                  onClick={handleToggleStatus}
                  disabled={isSaving || updateSprintMutation.isPending}
                  aria-label={isStarted ? 'Deactivate sprint' : 'Activate sprint'}
                >
                  <span className="toggle-switch-thumb" />
                </button>
              </div>
            </div>

            {/* Separator */}
            <div className="sprint-inspector-separator" />

            {/* Delete Section */}
            <div className="sprint-inspector-delete-section">
              <button
                className="sprint-inspector-delete-btn"
                onClick={handleDeleteClick}
                disabled={isSaving}
                type="button"
              >
                Delete Sprint
              </button>
            </div>

            {/* Separator */}
            <div className="sprint-inspector-separator" />
          </div>

          {/* Footer */}
          <footer className="sprint-inspector-footer">
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
              disabled={isSaving || updateSprintMutation.isPending}
            >
              {isSaving || updateSprintMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </footer>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete Sprint"
        message={`Are you sure you want to delete "${sprint.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="delete"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );

  return createPortal(inspectorContent, target);
};

export default SprintInspector;


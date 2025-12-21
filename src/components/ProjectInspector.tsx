import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { updateProject } from '../services/projectService';
import { useDeleteProject } from '../hooks/useProjects.ts';
import { useAutoResizeTextarea } from '../hooks/useAutoResizeTextarea.ts';
import ConfirmationModal from './ConfirmationModal.tsx';
import '../styles/project_inspector.css';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  ownerId?: string;
  owner?: {
    id: string;
  };
}

interface ProjectInspectorProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

/**
 * ProjectInspector Component
 * 
 * Right-side inspector panel for editing project details.
 * Apple-style design with slide-in animation.
 */
const ProjectInspector: React.FC<ProjectInspectorProps> = ({
  project,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const deleteProjectMutation = useDeleteProject();
  
  // Auto-resize textarea for description
  const descriptionTextareaRef = useAutoResizeTextarea(description, 4);
  
  // Get logged-in user ID and check if user is project owner
  const loggedInUserId = localStorage.getItem("userId");
  const projectOwnerId = project?.ownerId || project?.owner?.id;
  const isOwner = loggedInUserId && projectOwnerId && loggedInUserId === projectOwnerId;

  // Update local state when project changes
  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
    } else {
      // Reset form when project is cleared
      setName('');
      setDescription('');
    }
  }, [project?.id, project?.name, project?.description]);

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
    if (!project) return;

    // Validate name is not empty
    if (!name.trim()) {
      console.error('Project name is required');
      return;
    }

    setIsSaving(true);
    try {
      await updateProject(project.id, { name: name.trim(), description: description.trim() });
      onUpdate();
      
      // Small delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onClose();
    } catch (error) {
      console.error('Error saving project:', error);
      // Don't close on error - let user see the error and retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (): void => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!project) return;

    // Safety check: Only allow deletion if user is the project owner
    const projectOwnerId = project.ownerId || project.owner?.id;
    if (!isOwner) {
      console.error('❌ Only project owners can delete projects');
      alert('Only project owners can delete projects.');
      setShowDeleteConfirm(false);
      return;
    }

    setShowDeleteConfirm(false);
    setIsSaving(true);
    try {
      await deleteProjectMutation.mutateAsync(project.id);
      onDelete();
      
      // Small delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onClose();
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCancel = (): void => {
    setShowDeleteConfirm(false);
  };

  if (!project || !isOpen) return null;

  const target = document.getElementById('modal-root') ?? document.body;

  const inspectorContent = (
    <div 
      className="project-inspector-backdrop is-open"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Inspector Panel */}
      <div 
        className="project-inspector is-open"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-inspector-content">
          {/* Header */}
          <header className="project-inspector-header">
            <button
              className="project-inspector-back"
              onClick={onClose}
              aria-label="Back"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <h2 className="project-inspector-title">Project Details</h2>
            <div style={{ width: '32px' }} /> {/* Spacer for alignment */}
          </header>

          {/* Body */}
          <div className="project-inspector-body">
            {/* Name */}
            <div className="inspector-field">
              <label htmlFor="project-name" className="inspector-label">
                Name
              </label>
              <input
                id="project-name"
                type="text"
                className="inspector-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name..."
                disabled={isSaving}
              />
            </div>

            {/* Description */}
            <div className="inspector-field">
              <label htmlFor="project-description" className="inspector-label">
                Description
              </label>
              <textarea
                ref={descriptionTextareaRef}
                id="project-description"
                className="inspector-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Enter project description..."
                disabled={isSaving}
                style={{ resize: 'none', overflow: 'hidden' }}
              />
            </div>

            {/* Separator */}
            <div className="project-inspector-separator" />

            {/* Delete Section - Only visible to project owners */}
            {isOwner && (
              <div className="project-inspector-delete-section">
                <button
                  className="project-inspector-delete-btn"
                  onClick={handleDeleteClick}
                  disabled={isSaving || deleteProjectMutation.isPending}
                  type="button"
                >
                  {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            )}

            {/* Separator */}
            <div className="project-inspector-separator" />
          </div>

          {/* Footer - Hide when delete confirmation is shown */}
          {!showDeleteConfirm && (
            <footer className="project-inspector-footer">
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
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
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

export default ProjectInspector;




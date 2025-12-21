import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSprint, useUpdateSprint, useDeleteSprint } from "../hooks/useSprints.ts";
import { useScrollIndicators } from "../hooks/useScrollIndicators.ts";
import { useToast } from "../contexts/ToastContext.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faSpinner, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea.ts";
import ConfirmationModal from "./ConfirmationModal.tsx";
import "../styles/create_sprint.css";
import "../styles/account_details.css"; // For danger-action-btn styles

/**
 * EditSprint Component
 * 
 * Provides UI and logic to edit an existing sprint for the currently selected project.
 * Similar to CreateSprint but pre-populated with existing sprint data.
 */
const EditSprint: React.FC = () => {
  const navigate = useNavigate();
  const { sprintId } = useParams();
  const { showError, showSuccess } = useToast();

  const [sprintName, setSprintName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // TanStack Query hooks
  const { data: sprintData, isLoading: loading, error: sprintError } = useSprint(sprintId);
  const updateSprintMutation = useUpdateSprint();
  const deleteSprintMutation = useDeleteSprint();

  // Progressive Disclosure + Affordance scroll indicators
  const containerRef = useScrollIndicators([sprintName, startDate, endDate]);

  // Load sprint data into form fields when data is available
  useEffect(() => {
    if (sprintData) {
      setSprintName(sprintData.name || "");
      setDescription(sprintData.description || "");
      // Convert ISO date strings to YYYY-MM-DD format for date inputs
      if (sprintData.startDate) {
        setStartDate(sprintData.startDate.split("T")[0]);
      }
      if (sprintData.endDate) {
        setEndDate(sprintData.endDate.split("T")[0]);
      }
    }
  }, [sprintData]);

  // Show error from TanStack Query
  useEffect(() => {
    if (sprintError) {
      showError(String(sprintError) || "Failed to load sprint details.");
    }
  }, [sprintError, showError]);

  const handleUpdateSprint = async (): Promise<void> => {
    if (!sprintName.trim() || !startDate || !endDate) {
      showError("Sprint name, start date, and end date are required.");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      showError("End date must be after start date.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateSprintMutation.mutateAsync({
        sprintId: sprintId!,
        sprintData: {
          name: sprintName.trim(),
          description: description.trim() || `Sprint: ${sprintName.trim()}`,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
        }
      });

      showSuccess("Sprint updated successfully");
      navigate("/backlog");
    } catch (err: any) {
      showError(err.message || "Failed to update sprint.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (): void => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);

    try {
      await deleteSprintMutation.mutateAsync(sprintId!);
      showSuccess("Sprint deleted successfully");
      navigate("/backlog");
    } catch (err: any) {
      showError(err.message || "Failed to delete sprint.");
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = (): void => {
    setShowDeleteConfirm(false);
  };

  if (loading) {
    return (
      <div className="create-sprint-container">
        <div className="loading-message">
          <FontAwesomeIcon icon={faSpinner} spin />
          <p>Loading sprint details...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="create-sprint-container with-footer-pad">
      {/* Apple-Style Navigation Bar */}
      <div className="create-sprint-nav-bar">
        <button 
          className="back-nav-btn"
          onClick={() => navigate("/backlog")}
          disabled={isSubmitting || isDeleting}
        >
          <FontAwesomeIcon icon={faChevronLeft} />
          <span>Backlog</span>
        </button>
        <h1 className="create-sprint-title">Edit Sprint</h1>
        <div className="nav-spacer"></div>
      </div>


      <div className="create-sprint-form">
        <div className="form-group">
          <label htmlFor="sprintName" className="form-label">Sprint Name *</label>
          <input
            type="text"
            id="sprintName"
            value={sprintName}
            onChange={(e) => setSprintName(e.target.value)}
            className="form-input"
            placeholder="Enter sprint name"
            maxLength={100}
            disabled={isSubmitting || isDeleting}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">Description</label>
          <textarea
            ref={descriptionTextareaRef}
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-input"
            placeholder="Enter sprint description (optional)"
            rows={3}
            maxLength={500}
            disabled={isSubmitting || isDeleting}
            style={{ resize: 'none', overflow: 'hidden' }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="startDate" className="form-label">Start Date *</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="form-input"
            min={new Date().toISOString().split('T')[0]}
            disabled={isSubmitting || isDeleting}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="endDate" className="form-label">End Date *</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="form-input"
            min={startDate || new Date().toISOString().split('T')[0]}
            disabled={isSubmitting || isDeleting}
            required
          />
        </div>

        <div className="form-actions">
          <button 
            onClick={handleUpdateSprint} 
            disabled={isSubmitting || isDeleting || !sprintName.trim() || !startDate || !endDate}
            className="primary-action-btn"
          >
            {isSubmitting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
          <button 
            onClick={handleDeleteClick} 
            disabled={isSubmitting || isDeleting}
            className="danger-action-btn"
          >
            {isDeleting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                Deleting...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faTrash} />
                Delete Sprint
              </>
            )}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete Sprint"
        message={`Are you sure you want to delete "${sprintName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="delete"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default EditSprint;


import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSelectedProject } from "../services/storageService";
import { useCreateSprint } from "../hooks/useSprints.ts";
import { useScrollIndicators } from "../hooks/useScrollIndicators.ts";
import { useToast } from "../contexts/ToastContext.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { isValidText, isValidDateRange, isEndDateAfterStartDate } from "../utils/validation.ts";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea.ts";
import "../styles/create_sprint.css";
import "../styles/project_details.css"; // For char-count styling

/**
 * CreateSprint Component
 * 
 * Provides UI and logic to create a new sprint for the currently selected project.
 */
const CreateSprint: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showError, showSuccess } = useToast();
  
  // Get query parameters for project ID
  const queryParams = new URLSearchParams(location.search);
  const urlProjectId = queryParams.get('projectId');
  
  const storedProjectIdRaw = getSelectedProject();
  
  // Validate URL parameter - treat "undefined", "null", and empty string as invalid
  const isValidUrlProjectId = urlProjectId && 
    urlProjectId !== 'undefined' && 
    urlProjectId !== 'null' && 
    urlProjectId.trim() !== '';
  
  // Prioritize valid URL parameter over stored project
  const projectId = isValidUrlProjectId ? urlProjectId : storedProjectIdRaw;
  
  
  
  const [sprintName, setSprintName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [startImmediately, setStartImmediately] = useState<boolean>(false);
  
  // Auto-resize textarea for description
  const descriptionTextareaRef = useAutoResizeTextarea(description, 4);
  
  // Calculate max date (1 year from today)
  const maxDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  }, []);
  
  const today = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);
  
  // Progressive Disclosure + Affordance scroll indicators
  // Don't pass text values as dependencies - they cause re-renders on every keystroke
  const containerRef = useScrollIndicators([]);
  
  // Mutation hook for creating sprints
  const createSprintMutation = useCreateSprint();
  
  const handleCreateSprintSubmit = async (): Promise<void> => {
    // Validate required fields
    if (!sprintName.trim() || !startDate || !endDate) {
      showError("All fields are required.");
      return;
    }
    
    // Validate projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null' || projectId.trim() === '') {
      showError("No project selected. Please select a project first.");
      return;
    }
    
    // Validate name length
    if (sprintName.length > 50) {
      showError("Sprint name cannot exceed 50 characters.");
      return;
    }
    
    // Validate character restrictions
    if (!isValidText(sprintName)) {
      showError("Sprint name contains invalid characters. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.");
      return;
    }
    
    if (description && !isValidText(description)) {
      showError("Description contains invalid characters. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.");
      return;
    }
    
    // Validate description length
    if (description.length > 255) {
      showError("Description cannot exceed 255 characters.");
      return;
    }
    
    // Validate date range (start date)
    if (!isValidDateRange(startDate, 1)) {
      const startDateObj = new Date(startDate);
      const todayObj = new Date();
      todayObj.setHours(0, 0, 0, 0);
      
      if (startDateObj < todayObj) {
        showError("Start date cannot be in the past.");
      } else {
        showError("Start date cannot be more than 1 year in the future.");
      }
      return;
    }
    
    // Validate date range (end date)
    if (!isValidDateRange(endDate, 1)) {
      const endDateObj = new Date(endDate);
      const todayObj = new Date();
      todayObj.setHours(0, 0, 0, 0);
      
      if (endDateObj < todayObj) {
        showError("End date cannot be in the past.");
      } else {
        showError("End date cannot be more than 1 year in the future.");
      }
      return;
    }
    
    // Validate end date is after start date
    if (!isEndDateAfterStartDate(startDate, endDate)) {
      showError("End date must be after start date.");
      return;
    }
    
    try {
      await createSprintMutation.mutateAsync({
        projectId,
        sprintData: {
          name: sprintName.trim(),
          description: description.trim() || `Sprint: ${sprintName.trim()}`,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          isStarted: startImmediately
        }
      });
      
      showSuccess("Sprint created successfully");
      navigate("/backlog");
    } catch (err: any) {
      showError(err.message || "Failed to create sprint.");
    }
  };
  
  if (!projectId) {
    return (
      <div className="create-sprint-container">
        <div className="no-project-message">
          <h2>No Project Selected</h2>
          <p>Please select a project before creating a sprint.</p>
          <button onClick={() => navigate("/projects")} className="btn-primary">
            Go to Projects
          </button>
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
        >
          <FontAwesomeIcon icon={faChevronLeft} />
          <span>Backlog</span>
        </button>
        <h1 className="create-sprint-title">New Sprint</h1>
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
            maxLength={50}
            autoFocus
          />
          <div className="char-count">{sprintName.length}/50</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="sprintDescription" className="form-label">Description</label>
          <textarea
            ref={descriptionTextareaRef}
            id="sprintDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-input"
            placeholder="Enter sprint description (optional)"
            rows={4}
            maxLength={255}
            style={{ resize: 'none', overflow: 'hidden' }}
          />
          <div className="char-count">{description.length}/255</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="startDate" className="form-label">Start Date *</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="form-input"
            min={today}
            max={maxDate}
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
            min={startDate || today}
            max={maxDate}
          />
        </div>
        
        <div className="form-group toggle-group">
          <div className="toggle-container">
            <label className="toggle-label">Start Sprint Immediately</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="startImmediately"
                checked={startImmediately}
                onChange={(e) => setStartImmediately(e.target.checked)}
                className="toggle-input"
              />
              <label htmlFor="startImmediately" className="toggle-slider"></label>
            </div>
          </div>
        </div>
        
        
        <div className="form-actions">
          <button 
            onClick={handleCreateSprintSubmit} 
            disabled={createSprintMutation.isPending}
            className="create-sprint-btn"
          >
            {createSprintMutation.isPending ? "Creating..." : "Create Sprint"}
          </button>
          <button 
            onClick={() => navigate("/backlog")} 
            className="cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSprint;

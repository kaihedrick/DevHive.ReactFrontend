import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSelectedProject } from "../services/storageService";
import { useCreateSprint } from "../hooks/useSprints.ts";
import { useScrollIndicators } from "../hooks/useScrollIndicators.ts";
import { useToast } from "../contexts/ToastContext.tsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import "../styles/create_sprint.css";

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
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [startImmediately, setStartImmediately] = useState<boolean>(false);
  
  // Progressive Disclosure + Affordance scroll indicators
  const containerRef = useScrollIndicators([sprintName, startDate, endDate]);
  
  // Mutation hook for creating sprints
  const createSprintMutation = useCreateSprint();
  
  const handleCreateSprintSubmit = async (): Promise<void> => {
    if (!sprintName || !startDate || !endDate) {
      showError("All fields are required.");
      return;
    }
    
    if (new Date(endDate) <= new Date(startDate)) {
      showError("End date must be after start date.");
      return;
    }
    
    // Validate projectId - check for null, undefined, empty string, or invalid string values
    if (!projectId || projectId === 'undefined' || projectId === 'null' || projectId.trim() === '') {
      showError("No project selected. Please select a project first.");
      return;
    }
    
    if (!sprintName.trim()) {
      showError("Sprint name cannot be empty.");
      return;
    }
    
    try {
      await createSprintMutation.mutateAsync({
        projectId,
        sprintData: {
          name: sprintName,
          description: `Sprint: ${sprintName}`,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString()
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
          <label htmlFor="sprintName" className="form-label">Sprint Name</label>
          <input
            type="text"
            id="sprintName"
            value={sprintName}
            onChange={(e) => setSprintName(e.target.value)}
            className="form-input"
            placeholder="Enter sprint name"
            maxLength={100}
            autoFocus
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="startDate" className="form-label">Start Date</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="form-input"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="endDate" className="form-label">End Date</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="form-input"
            min={startDate || new Date().toISOString().split('T')[0]}
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

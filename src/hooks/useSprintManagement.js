import { useState, useCallback, useEffect } from 'react';
import { 
  fetchProjectSprints,
  createSprint,
  editSprint,
  startSprint,
  completeSprint,
  checkSprintDateOverlap,
  getDisabledDates
} from '../services/sprintService';

export const useSprintManagement = (projectId) => {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSprint, setSelectedSprint] = useState(null);

  // Sort sprints by start date (earliest first)
  const sortedSprints = sprints.length > 0 
    ? [...sprints].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    : [];

  // Find next sprint to start (not started and earliest date)
  const nextSprintToStart = sortedSprints.find(sprint => 
    !sprint.isStarted && new Date(sprint.startDate) >= new Date()
  );

  // Active sprint (started but not completed)
  const activeSprint = sortedSprints.find(sprint => 
    sprint.isStarted && !sprint.isCompleted
  );

  const fetchSprints = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await fetchProjectSprints(projectId);
      setSprints(data || []);
      setError(null);
    } catch (err) {
      // Check if this is an auth error (401)
      if (err.response && err.response.status === 401) {
        console.error("Authentication error when fetching sprints:", err);
        setError("Your session has expired. Please log in again.");
        // Optionally redirect to login page or show a login modal
      } else {
        setError(err.message || "Failed to load sprints");
        console.error("Error fetching sprints:", err);
      }
      setSprints([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleCreateSprint = async (sprintData) => {
    try {
      setLoading(true);
      await createSprint({ ...sprintData, projectID: projectId });
      await fetchSprints(); // Refresh sprints after creation
      return { success: true };
    } catch (err) {
      // Check if this is an auth error
      if (err.response && err.response.status === 401) {
        setError("Your session has expired. Please log in again.");
      } else {
        setError(err.message || "Failed to create sprint");
      }
      console.error("Error creating sprint:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSprint = async (sprintData) => {
    try {
      setLoading(true);
      await editSprint(sprintData);
      await fetchSprints(); // Refresh sprints after update
      return { success: true };
    } catch (err) {
      setError(err.message || "Failed to update sprint");
      console.error("Error updating sprint:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const handleStartSprint = async (sprintId) => {
    try {
      setLoading(true);
      await startSprint(sprintId);
      await fetchSprints(); // Refresh sprints after starting
      return { success: true };
    } catch (err) {
      setError(err.message || "Failed to start sprint");
      console.error("Error starting sprint:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSprint = async (sprintId) => {
    try {
      setLoading(true);
      await completeSprint(sprintId);
      await fetchSprints(); // Refresh sprints after completing
      return { success: true };
    } catch (err) {
      setError(err.message || "Failed to complete sprint");
      console.error("Error completing sprint:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Check if dates overlap with existing sprints
  const validateSprintDates = (startDate, endDate, currentSprintId = null) => {
    // Validate that end date is after start date
    if (new Date(endDate) <= new Date(startDate)) {
      return { valid: false, error: "End date must be after start date" };
    }
    
    // Check for date overlaps with existing sprints
    if (checkSprintDateOverlap(startDate, endDate, sprints, currentSprintId)) {
      return { valid: false, error: "Sprint dates overlap with existing sprints" };
    }
    
    return { valid: true };
  };

  // Get disabled dates for date picker
  const getSprintDisabledDates = (currentSprintId = null) => {
    return getDisabledDates(sprints, currentSprintId);
  };

  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);

  return {
    sprints,
    sortedSprints,
    selectedSprint,
    setSelectedSprint,
    nextSprintToStart,
    activeSprint,
    loading,
    error,
    fetchSprints,
    handleCreateSprint,
    handleUpdateSprint,
    handleStartSprint,
    handleCompleteSprint,
    validateSprintDates,
    getSprintDisabledDates
  };
};
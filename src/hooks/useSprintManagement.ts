import { useState, useCallback, useEffect } from 'react';
import { 
  fetchProjectSprints,
  createSprint,
  updateSprint,
  startSprint,
  completeSprint,
  checkSprintDateOverlap,
  getDisabledDates
} from '../services/sprintService';
import { 
  UseSprintManagementReturn, 
  Sprint, 
  CreateSprintData, 
  UpdateSprintData 
} from '../types/hooks.ts';

/**
 * useSprintManagement
 *
 * Custom hook for managing sprints in a given project.
 *
 * @param {string} projectId - The ID of the project whose sprints are being managed
 * @returns {UseSprintManagementReturn} Sprint state and handler functions
 */
export const useSprintManagement = (projectId: string): UseSprintManagementReturn => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);

  // Sort sprints by start date (earliest first)
  const sortedSprints = sprints.length > 0 
    ? [...sprints].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    : [];

  // Find next sprint to start (not started and earliest date)
  const nextSprintToStart = sortedSprints.find(sprint => 
    !sprint.isStarted && new Date(sprint.startDate) >= new Date()
  ) || null;

  // Active sprint (started but not completed)
  const activeSprint = sortedSprints.find(sprint => 
    sprint.isStarted && !sprint.isCompleted
  ) || null;

  const fetchSprints = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetchProjectSprints(projectId, { limit: 100, offset: 0 });
      setSprints(response.sprints || []);
      setError(null);
    } catch (err: any) {
      // Check if this is an auth error (401)
      if (err.response && err.response.status === 401) {
        console.error("Authentication error when fetching sprints:", err);
        setError("Your session has expired. Please log in again.");
      } else {
        setError(err.message || "Failed to load sprints");
        console.error("Error fetching sprints:", err);
      }
      setSprints([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleCreateSprint = async (sprintData: CreateSprintData): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      // Transform data for Go/PostgreSQL API
      const payload = {
        name: sprintData.name,
        description: sprintData.description,
        startDate: sprintData.startDate,
        endDate: sprintData.endDate
      };
      
      await createSprint(projectId, payload);
      await fetchSprints(); // Refresh sprints after creation
      return { success: true };
    } catch (err: any) {
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

  const handleUpdateSprint = async (sprintData: UpdateSprintData): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      // Transform data for Go/PostgreSQL API
      const payload = {
        name: sprintData.name,
        description: sprintData.description,
        startDate: sprintData.startDate,
        endDate: sprintData.endDate
      };
      
      await updateSprint(sprintData.id, payload);
      await fetchSprints(); // Refresh sprints after update
      return { success: true };
    } catch (err: any) {
      setError(err.message || "Failed to update sprint");
      console.error("Error updating sprint:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const handleStartSprint = async (sprintId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      await startSprint(sprintId);
      await fetchSprints(); // Refresh sprints after starting
      return { success: true };
    } catch (err: any) {
      setError(err.message || "Failed to start sprint");
      console.error("Error starting sprint:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSprint = async (sprintId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      await completeSprint(sprintId);
      await fetchSprints(); // Refresh sprints after completing
      return { success: true };
    } catch (err: any) {
      setError(err.message || "Failed to complete sprint");
      console.error("Error completing sprint:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Check if dates overlap with existing sprints
  const validateSprintDates = (startDate: string, endDate: string, currentSprintId?: string): { valid: boolean; error?: string } => {
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
  const getSprintDisabledDates = (currentSprintId?: string): Array<{ start: Date; end: Date }> => {
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

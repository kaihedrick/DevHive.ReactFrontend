import { useState, useMemo } from 'react';
import { 
  checkSprintDateOverlap,
  getDisabledDates
} from '../services/sprintService';
import { 
  useSprints,
  useCreateSprint,
  useUpdateSprint,
  useStartSprint,
  useCompleteSprint
} from './useSprints.ts';
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
 * Now uses TanStack Query for caching and data management.
 *
 * @param {string} projectId - The ID of the project whose sprints are being managed
 * @returns {UseSprintManagementReturn} Sprint state and handler functions
 */
export const useSprintManagement = (projectId: string): UseSprintManagementReturn => {
  // UI state only - TanStack Query manages data state
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);

  // TanStack Query hooks for data fetching
  const { data: sprintsData, isLoading, error: queryError } = useSprints(projectId, { limit: 100, offset: 0 });
  
  // Mutation hooks
  const createSprintMutation = useCreateSprint();
  const updateSprintMutation = useUpdateSprint();
  const startSprintMutation = useStartSprint();
  const completeSprintMutation = useCompleteSprint();

  // Extract sprints array from response
  const sprints: Sprint[] = useMemo(() => {
    if (!sprintsData) return [];
    return sprintsData.sprints || sprintsData || [];
  }, [sprintsData]);

  // Convert error to string for compatibility
  const error: string | null = queryError ? String(queryError) : null;

  // Sort sprints by start date (earliest first)
  const sortedSprints = useMemo(() => {
    return sprints.length > 0 
      ? [...sprints].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      : [];
  }, [sprints]);

  // Find next sprint to start (not started and earliest date)
  const nextSprintToStart = useMemo(() => {
    return sortedSprints.find(sprint => 
      !sprint.isStarted && new Date(sprint.startDate) >= new Date()
    ) || null;
  }, [sortedSprints]);

  // Active sprint (started but not completed)
  const activeSprint = useMemo(() => {
    return sortedSprints.find(sprint => 
      sprint.isStarted && !sprint.isCompleted
    ) || null;
  }, [sortedSprints]);

  // Refetch function for backward compatibility (TanStack Query handles this automatically)
  const fetchSprints = async (): Promise<void> => {
    // TanStack Query automatically refetches when query key changes
    // This function exists for interface compatibility only
  };

  const handleCreateSprint = async (sprintData: CreateSprintData): Promise<{ success: boolean; error?: string }> => {
    try {
      // Transform data for Go/PostgreSQL API
      const payload = {
        name: sprintData.name,
        description: sprintData.description,
        startDate: sprintData.startDate,
        endDate: sprintData.endDate
      };
      
      await createSprintMutation.mutateAsync({ projectId, sprintData: payload });
      // Cache invalidation handled automatically by mutation
      return { success: true };
    } catch (err: any) {
      console.error("Error creating sprint:", err);
      return { success: false, error: err.message || "Failed to create sprint" };
    }
  };

  const handleUpdateSprint = async (sprintData: UpdateSprintData): Promise<{ success: boolean; error?: string }> => {
    try {
      // Transform data for Go/PostgreSQL API
      const payload = {
        name: sprintData.name,
        description: sprintData.description,
        startDate: sprintData.startDate,
        endDate: sprintData.endDate
      };
      
      await updateSprintMutation.mutateAsync({ sprintId: sprintData.id, sprintData: payload });
      // Cache invalidation handled automatically by mutation
      return { success: true };
    } catch (err: any) {
      console.error("Error updating sprint:", err);
      return { success: false, error: err.message || "Failed to update sprint" };
    }
  };

  const handleStartSprint = async (sprintId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await startSprintMutation.mutateAsync(sprintId);
      // Cache invalidation handled automatically by mutation
      return { success: true };
    } catch (err: any) {
      console.error("Error starting sprint:", err);
      return { success: false, error: err.message || "Failed to start sprint" };
    }
  };

  const handleCompleteSprint = async (sprintId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await completeSprintMutation.mutateAsync(sprintId);
      // Cache invalidation handled automatically by mutation
      return { success: true };
    } catch (err: any) {
      console.error("Error completing sprint:", err);
      return { success: false, error: err.message || "Failed to complete sprint" };
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

  return {
    sprints,
    sortedSprints,
    selectedSprint,
    setSelectedSprint,
    nextSprintToStart,
    activeSprint,
    loading: isLoading,
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

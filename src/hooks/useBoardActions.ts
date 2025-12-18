import { useState, useEffect } from 'react';
import { fetchProjectSprints } from '../services/sprintService';
import { fetchSprintTasks, updateTaskStatus, updateTask, assignTask } from '../services/taskService';
import { fetchProjectMembers } from '../services/projectService';
import { useToast } from '../contexts/ToastContext.tsx';
import { UseBoardActionsReturn, Sprint, Task, User } from '../types/hooks.ts';

/**
 * useBoardActions
 *
 * Custom hook to manage board-related logic for the project Kanban board.
 *
 * @param {string} projectId - The ID of the project to load sprints and tasks for.
 * @returns {UseBoardActionsReturn} Hook state and actions
 */
const useBoardActions = (projectId: string): UseBoardActionsReturn => {
  const { showSuccess, showError } = useToast();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch sprints and members on component mount
  useEffect(() => {
    if (!projectId) {
      setError("No project selected. Please select a project first.");
      setLoading(false);
      setSprints([]);
      setMembers([]);
      return;
    }

    const loadSprintsAndMembers = async (): Promise<void> => {
      try {
        setLoading(true);
        const [sprintsResponse, membersResponse] = await Promise.all([
          fetchProjectSprints(projectId),
          fetchProjectMembers(projectId)
        ]);
        
        // Extract sprints and members arrays from paginated responses
        const sprintsData = sprintsResponse.sprints || sprintsResponse || [];
        const membersData = membersResponse.members || membersResponse || [];
        
        console.log("🔍 Sprints response:", sprintsResponse);
        console.log("🔍 Extracted sprints data:", sprintsData);
        console.log("🔍 Is sprints data array?", Array.isArray(sprintsData));
        
        setSprints(Array.isArray(sprintsData) ? sprintsData : []);
        setMembers(Array.isArray(membersData) ? membersData : []);
        
        // Set the first sprint as selected by default if available
        if (sprintsData && sprintsData.length > 0) {
          setSelectedSprint(sprintsData[0].id);
          await loadTasks(sprintsData[0].id);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        const errorMsg = "Failed to load data: " + err.message;
        setError(errorMsg);
        showError(errorMsg);
        setLoading(false);
      }
    };

    loadSprintsAndMembers();
  }, [projectId]);

  // Load tasks when selected sprint changes
  const loadTasks = async (sprintId: string): Promise<void> => {
    if (!sprintId) return;
    
    try {
      setLoading(true);
      const response = await fetchSprintTasks(sprintId);
      
      // Extract tasks array from the paginated response
      const tasksData = response.tasks || response || [];
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setLoading(false);
    } catch (err: any) {
      const errorMsg = "Failed to load tasks: " + err.message;
      setError(errorMsg);
      showError(errorMsg);
      setLoading(false);
    }
  };

  // Handle sprint selection change
  const handleSprintChange = async (e: React.ChangeEvent<HTMLSelectElement>): Promise<void> => {
    const sprintId = e.target.value;
    setSelectedSprint(sprintId);
    await loadTasks(sprintId);
  };

  // Handle assignee change
  const handleAssigneeChange = async (task: Task, newAssigneeId: string): Promise<void> => {
    try {
      console.log("Task being updated:", task);
      console.log("New assignee ID:", newAssigneeId);
      
      // Convert empty string to null for unassigned
      const assigneeValue = newAssigneeId === "" ? null : newAssigneeId;
      
      if (assigneeValue === null) {
        // Handle unassignment - use updateTask to set assigneeId to null
        await updateTask(task.id, { assigneeId: null });
      } else {
        // Use assignTask for proper assignee assignment
        await assignTask(task.id, assigneeValue);
      }
      
      // Update the task in the state
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === task.id 
            ? { ...t, assigneeId: assigneeValue } // Use assigneeId to match API response
            : t
        )
      );
      
      // Show success message
      const successMsg = assigneeValue ? "Task assigned" : "Task unassigned";
      setSuccessMessage(successMsg);
      showSuccess(successMsg);
    } catch (err: any) {
      console.error("❌ Error updating task assignee:", err);
      const errorMsg = `Failed to update task assignee: ${err.message}`;
      setError(errorMsg);
      showError(errorMsg);
    }
  };

  // Handle task status update (when dropped in a column)
  const handleStatusUpdate = async (taskId: string, newStatus: number): Promise<boolean> => {
    try {
      // Validate status values for Go/PostgreSQL backend
      const validStatuses = [0, 1, 2]; // 0: pending, 1: in_progress, 2: completed
      const numericStatus = Number(newStatus);
      
      if (!validStatuses.includes(numericStatus)) {
        throw new Error(`Invalid status value: ${newStatus}. Must be 0, 1, or 2`);
      }
      
      // Update task status in the backend
      await updateTaskStatus(taskId, numericStatus);
      
      // Update task status in the state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: numericStatus } 
            : task
        )
      );
      
      // Show success message
      const statusText = numericStatus === 0 ? 'To Do' : numericStatus === 1 ? 'In Progress' : 'Completed';
      const successMsg = `Task moved to ${statusText}`;
      setSuccessMessage(successMsg);
      showSuccess(successMsg);
      
      return true;
    } catch (err: any) {
      const errorMsg = `Failed to update task status: ${err.message}`;
      setError(errorMsg);
      showError(errorMsg);
      return false;
    }
  };

  // Filter tasks by status
  const getTasksByStatus = (status: number): Task[] => {
    if (!Array.isArray(tasks)) {
      console.warn("⚠️ Tasks is not an array:", tasks);
      return [];
    }
    
    return tasks.filter((task) => task.status === status);
  };

  // Format date from ISO string
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Find member name by ID
  const getAssigneeName = (assigneeId: string | null): string => {
    if (!assigneeId) return 'Unassigned';
    const member = members.find(m => m.id === assigneeId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  return {
    sprints,
    selectedSprint,
    tasks,
    members,
    loading,
    error,
    successMessage,
    draggedTask,
    setDraggedTask,
    setError,
    getTasksByStatus,
    formatDate,
    getAssigneeName,
    handleSprintChange,
    handleAssigneeChange,
    handleStatusUpdate,
    setSuccessMessage,
  };
};

export default useBoardActions;

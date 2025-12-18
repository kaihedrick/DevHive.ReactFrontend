import { useState, useEffect } from 'react';
import { fetchProjectSprints } from '../services/sprintService';
import { fetchSprintTasks, updateTaskStatus, editTask } from '../services/taskService';
import { fetchProjectMembers } from '../services/projectService';
/**
 * useBoardActions
 *
 * Custom hook to manage board-related logic for the project Kanban board.
 *
 * @param {string} projectId - The ID of the project to load sprints and tasks for.
 * @returns {Object} Hook state and actions
 *   sprints - List of sprints for the project.
 *   selectedSprint - Currently selected sprint ID.
 *   tasks - List of tasks for the selected sprint.
 *   members - Project members available for task assignment.
 *   loading - Boolean indicating whether data is being loaded.
 *   error - Error message string, if any.
 *   successMessage - Status message for UI feedback.
 *   draggedTask - The task currently being dragged.
 *   setDraggedTask - Function to update the dragged task state.
 *   setError - Function to update the error state.
 *   getTasksByStatus - Function to return tasks filtered by status.
 *   formatDate - Formats ISO string into a human-readable date.
 *   getAssigneeName - Returns the full name of a task assignee.
 *   handleSprintChange - Callback to handle sprint dropdown changes.
 *   handleAssigneeChange - Assigns or unassigns a task to a user.
 *   handleStatusUpdate - Updates the status of a task after drag-and-drop.
 *   setSuccessMessage - Function to update the success message state.
 */
const useBoardActions = (projectId) => {
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch sprints and members on component mount
  useEffect(() => {
    if (!projectId) {
      setError("No project selected. Please select a project first.");
      setLoading(false);
      return;
    }

    const loadSprintsAndMembers = async () => {
      try {
        setLoading(true);
        const [fetchedSprints, fetchedMembers] = await Promise.all([
          fetchProjectSprints(projectId),
          fetchProjectMembers(projectId)
        ]);
        
        setSprints(fetchedSprints || []);
        setMembers(fetchedMembers || []);
        
        // Set the first sprint as selected by default if available
        if (fetchedSprints && fetchedSprints.length > 0) {
          setSelectedSprint(fetchedSprints[0].id);
          await loadTasks(fetchedSprints[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError("Failed to load data: " + err.message);
        setLoading(false);
      }
    };

    loadSprintsAndMembers();
  }, [projectId]);

  // Load tasks when selected sprint changes
  const loadTasks = async (sprintId) => {
    if (!sprintId) return;
    
    try {
      setLoading(true);
      const fetchedTasks = await fetchSprintTasks(sprintId);
      
      setTasks(fetchedTasks || []);
      setLoading(false);
    } catch (err) {
      setError("Failed to load tasks: " + err.message);
      setLoading(false);
    }
  };

  // Handle sprint selection change
  const handleSprintChange = async (e) => {
    const sprintId = e.target.value;
    setSelectedSprint(sprintId);
    await loadTasks(sprintId);
  };

  // Handle assignee change
  const handleAssigneeChange = async (task, newAssigneeId) => {
    try {
      console.log("Task being updated:", task);
      
      // Convert empty string to null for unassigned
      const assigneeValue = newAssigneeId === "" ? null : newAssigneeId;
      
      // Create a task object with only updatable fields
      const updatedTask = {
        id: task.id,
        description: task.description,
        assigneeId: assigneeValue // Use the converted value
      };
      
      console.log("Sending to backend:", updatedTask);
      
      // Update the task in the backend
      await editTask(updatedTask);
      
      // Update the task in the state - CORRECTLY this time
      setTasks(prevTasks => 
        prevTasks.map(t => 
          t.id === task.id 
            ? { ...t, assigneeId: assigneeValue } // Use assigneeValue here
            : t
        )
      );
      
      // Show success message
      setSuccessMessage(assigneeValue ? "Task assigned" : "Task unassigned");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("❌ Error updating task assignee:", err);
      setError(`Failed to update task assignee: ${err.message}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  // Handle task status update (when dropped in a column)
  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      // Update task status in the backend
      await updateTaskStatus(taskId, newStatus);
      
      // Update task status in the state
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: newStatus } 
            : task
        )
      );
      
      // Show success message
      const statusText = newStatus === 0 ? 'To Do' : newStatus === 1 ? 'In Progress' : 'Completed';
      setSuccessMessage(`Task moved to ${statusText}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
      return true;
    } catch (err) {
      setError(`Failed to update task status: ${err.message}`);
      setTimeout(() => setError(null), 3000);
      return false;
    }
  };

  // Filter tasks by status
  const getTasksByStatus = (status) => {
    return tasks.filter((task) => task.status === status);
  };

  // Format date from ISO string
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Find member name by ID
  const getAssigneeName = (assigneeId) => {
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
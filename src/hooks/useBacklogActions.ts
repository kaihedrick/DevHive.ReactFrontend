import { useNavigate } from "react-router-dom";
import { useUpdateTaskStatus, useUpdateTask } from "./useTasks.ts";
import { Task } from "../types/hooks.ts";

/**
 * useBacklogActions
 *
 * Custom React hook providing reusable handler functions for backlog actions.
 * Includes navigation and task update utilities.
 * Now uses TanStack Query mutations for caching.
 *
 * @returns {Object} Backlog action handlers
 */
const useBacklogActions = () => {
  const navigate = useNavigate();
  
  // TanStack Query mutations
  const updateTaskStatusMutation = useUpdateTaskStatus();
  const updateTaskMutation = useUpdateTask();

  // ✅ Navigate to Create Task Page
  const handleCreateTask = (): void => {
    navigate("/create-task");
  };

  // ✅ Navigate to Create Sprint Page
  const handleCreateSprint = (): void => {
    navigate("/create-sprint");
  };

  // ✅ Navigate to Edit Task Page
  const handleEditTask = (taskId: string): void => {
    navigate(`/edit-task/${taskId}`);
  };

  // ✅ Update Task Status
  const handleUpdateTaskStatus = async (task: Task, newStatus: number): Promise<void> => {
    try {
      console.log(`🔄 Updating status for Task ID: ${task.id} to ${newStatus}`);
      await updateTaskStatusMutation.mutateAsync({ taskId: task.id, status: newStatus });
      console.log(`✅ Task ${task.id} status updated successfully`);
      // Cache invalidation handled automatically by mutation
    } catch (error: any) {
      console.error(`❌ Error updating task status:`, error.message);
      alert("Failed to update task status. Please try again.");
    }
  };

  // Update Task Assignee
  const handleUpdateTaskAssignee = async (task: Task, newAssigneeId: string): Promise<void> => {
    try {
      console.log(`🔄 Updating assignee for Task ID: ${task.id} to User ID: ${newAssigneeId}`);
      await updateTaskMutation.mutateAsync({ 
        taskId: task.id, 
        taskData: { assigneeId: newAssigneeId }
      });
      console.log(`✅ Task ${task.id} assignee updated successfully`);
      // Cache invalidation handled automatically by mutation
    } catch (error: any) {
      console.error(`❌ Error updating task assignee:`, error.message);
      alert("Failed to update task assignee. Please try again.");
    }
  };

  return {
    handleCreateTask,
    handleCreateSprint,
    handleEditTask,
    handleUpdateTaskStatus,
    handleUpdateTaskAssignee,
  };
};

export default useBacklogActions;

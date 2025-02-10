import { useNavigate } from "react-router-dom";
import { editTask } from "../services/projectService";

const useBacklogActions = () => {
  const navigate = useNavigate();

  // ✅ Navigate to Create Task Page
  const handleCreateTask = () => {
    navigate("/create-task");
  };

  // ✅ Navigate to Create Sprint Page
  const handleCreateSprint = () => {
    navigate("/create-sprint");
  };

  // ✅ Navigate to Edit Task Page
  const handleEditTask = (taskId) => {
    navigate(`/edit-task/${taskId}`);
  };

  // ✅ Update Task Status
  const handleUpdateTaskStatus = async (task, newStatus) => {
    try {
      console.log(`🔄 Updating status for Task ID: ${task.id} to ${newStatus}`);
      await editTask({ ...task, status: newStatus });
      console.log(`✅ Task ${task.id} status updated successfully`);
    } catch (error) {
      console.error(`❌ Error updating task status:`, error.message);
      alert("Failed to update task status. Please try again.");
    }
  };

  // ✅ Update Task Assignee
  const handleUpdateTaskAssignee = async (task, newAssigneeId) => {
    try {
      console.log(`🔄 Updating assignee for Task ID: ${task.id} to User ID: ${newAssigneeId}`);
      await editTask({ ...task, assigneeID: newAssigneeId });
      console.log(`✅ Task ${task.id} assignee updated successfully`);
    } catch (error) {
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

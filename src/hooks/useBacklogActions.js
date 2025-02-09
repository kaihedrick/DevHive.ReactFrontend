import { useNavigate } from "react-router-dom";

const useBacklogActions = () => {
  const navigate = useNavigate();

  const handleCreateTask = () => {
    navigate("/create-task"); // ✅ Redirects to Create Task Page
  };

  const handleCreateSprint = () => {
    navigate("/create-sprint"); // ✅ Redirects to Create Sprint Page
  };

  return {
    handleCreateTask,
    handleCreateSprint,
  };
};

export default useBacklogActions;

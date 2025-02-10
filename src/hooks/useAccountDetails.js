import { useState, useEffect } from "react";
import { fetchUserById } from "../services/userService";
import { getAuthToken, getUserId, getSelectedProject } from "../services/projectService";
import { useNavigate } from "react-router-dom";

const useAccountDetails = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const userId = getUserId();

      if (!userId) {
        console.error("No user ID found, redirecting to login...");
        navigate("/login");
        return;
      }

      try {
        console.log("🔍 Fetching account details...");
        const userData = await fetchUserById(userId);
        setUser(userData);
      } catch (err) {
        console.error("❌ Error fetching user details:", err.message);
        setError("Failed to load account details.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Back Navigation Function
  const handleGoBack = () => {
    console.log("🔙 Returning to the previous page...");
    navigate(-1); // Go back to the previous page
  };

  // Logout function
  const handleLogout = () => {
    console.log("🚪 Logging out...");
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    navigate("/");
  };

  // Change password function (Placeholder)
  const handleChangePassword = () => {
    console.log("🔑 Changing password (Functionality to be implemented)");
    alert("Password change feature coming soon!");
  };

  // Leave group function
  const handleLeaveGroup = () => {
    const selectedProjectId = getSelectedProject();
    if (!selectedProjectId) {
      alert("⚠️ You haven't selected a project yet.");
      return;
    }
    console.log(`🏃 Leaving project ${selectedProjectId}...`);
  };

  return { user, loading, error, handleGoBack, handleLogout, handleChangePassword, handleLeaveGroup };
};

export default useAccountDetails;

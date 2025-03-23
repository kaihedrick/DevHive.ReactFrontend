import { useState, useEffect } from "react";
import { fetchUserById, updateUserProfile } from "../services/userService.ts";
import { getUserId, clearAuth } from "../services/authService";
import { getSelectedProject } from "../services/storageService";
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

  const handleGoBack = () => {
    console.log("🔙 Returning to the previous page...");
    navigate(-1);
  };

  const handleLogout = () => {
    console.log("🚪 Logging out...");
    clearAuth();
    navigate("/");
  };

  const updateUsername = async (newUsername) => {
    const userId = user?.ID || user?.id;

    if (!userId) throw new Error("User data is not available");

    try {
      console.log("🔄 Updating username to:", newUsername);

      const updatedUserData = {
        ID: userId,
        Username: newUsername,
        Email: user.Email,
        FirstName: user.FirstName,
        LastName: user.LastName,
      };

      const result = await updateUserProfile(updatedUserData);
      setUser(result);
      console.log("✅ Username updated successfully:", result);
      return result;
    } catch (err) {
      console.error("❌ Error updating username:", err);
      throw err;
    }
  };

  const handleChangePassword = async (newPassword) => {
    if (!user || !(user.ID || user.id)) {
      throw new Error("User data is not available");
    }

    const userId = user.ID || user.id;

    try {
      console.log("🔑 Changing password...");

      const passwordData = {
        ID: userId,
        Password: newPassword,
      };

      await updateUserProfile(passwordData);

      console.log("✅ Password changed successfully");
      return true;
    } catch (err) {
      console.error("❌ Error changing password:", err);
      throw err;
    }
  };

  const handleLeaveGroup = () => {
    const selectedProjectId = getSelectedProject();
    if (!selectedProjectId) {
      alert("⚠️ You haven't selected a project yet.");
      return;
    }
    console.log(`🏃 Leaving project ${selectedProjectId}...`);
    alert("Leave project feature coming soon!");
  };

  return {
    user,
    loading,
    error,
    handleGoBack,
    handleLogout,
    handleChangePassword,
    handleLeaveGroup,
    updateUsername
  };
};

export default useAccountDetails;

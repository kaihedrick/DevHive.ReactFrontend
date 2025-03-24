import { useState, useEffect } from "react";
import { fetchUserById, updateUserProfile } from "../services/userService.ts";
import { getUserId, clearAuth, validateUsername } from "../services/authService.ts";
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
        navigate("/");
        return;
      }

      try {
        console.log("🔍 Fetching account details...");
        const userData = await fetchUserById(userId);
        console.log("User data loaded:", userData);
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

  // Helper to safely get user property regardless of case
  const getUserProp = (propName) => {
    if (!user) return null;
    
    // Try lowercase version first (from API)
    const lowerProp = propName.toLowerCase();
    if (user[lowerProp] !== undefined) return user[lowerProp];
    
    // Then try capitalized version
    if (user[propName] !== undefined) return user[propName];
    
    // Then try uppercase first letter
    const capitalizedProp = propName.charAt(0).toUpperCase() + propName.slice(1).toLowerCase();
    if (user[capitalizedProp] !== undefined) return user[capitalizedProp];
    
    // Finally try all lowercase
    if (user[propName.toLowerCase()] !== undefined) return user[propName.toLowerCase()];
    
    return null;
  };

  // Update the updateUsername function
  const updateUsername = async (newUsername) => {
    // Get user ID regardless of case
    const userId = getUserProp('id');
    
    if (!userId) {
      console.error("User data is not available:", user);
      throw new Error("User data is not available");
    }

    // Get current username regardless of case
    const currentUsername = getUserProp('username');

    // Skip update if username hasn't changed
    if (newUsername === currentUsername) {
      console.log("✅ Username unchanged, skipping update");
      return user;
    }

    try {
      console.log(`🔍 Checking if "${newUsername}" is available...`);
      
      // Validate the username
      const isTaken = await validateUsername(newUsername, currentUsername);
      
      if (isTaken) {
        console.log("❌ Username is already in use, cannot update");
        throw new Error("Username is already in use");
      }
      
      console.log("✅ Username is available, proceeding with update");
      
      // Build update data - try both camelCase and PascalCase to ensure compatibility
      const updateData = {
        // Include both forms of ID
        id: userId,
        ID: userId,
        // Include both forms of each field
        username: newUsername,
        Username: newUsername,
        email: getUserProp('email'),
        Email: getUserProp('email'),
        firstName: getUserProp('firstName'),
        FirstName: getUserProp('firstName'),
        lastName: getUserProp('lastName'),
        LastName: getUserProp('lastName')
      };
      
      console.log("📤 Sending update:", updateData);
      
      // Perform the update
      const result = await updateUserProfile(updateData, user);
      console.log("📥 Update successful:", result);
      
      // Update local state
      setUser(result);
      return result;
    } catch (err) {
      console.error("❌ Error updating username:", err);
      throw err;
    }
  };

  const handleChangePassword = async (newPassword) => {
    const userId = getUserProp('id');
    
    if (!userId) {
      console.error("User data is not available:", user);
      throw new Error("User data is not available");
    }

    try {
      console.log("🔑 Changing password...");

      // Prepare update data maintaining the original casing from the API
      const passwordData = {
        id: userId,
        username: getUserProp('username'),
        email: getUserProp('email'),
        firstName: getUserProp('firstName'),
        lastName: getUserProp('lastName'),
        password: newPassword
      };

      // Send the update request
      const result = await updateUserProfile(passwordData);
      console.log("✅ Password changed successfully");
      
      // Update local state if API returned new data
      if (result) {
        setUser(result);
      }
      
      return true;
    } catch (err) {
      console.error("❌ Error changing password:", err);
      throw err;
    }
  };

  const handleLeaveGroup = () => {
    const selectedProjectId = getSelectedProject();
  
    if (!selectedProjectId) {
      alert("⚠️ You haven't selected a project. Join or select a project first.");
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
    updateUsername,
    getUserProp
  };
};

export default useAccountDetails;
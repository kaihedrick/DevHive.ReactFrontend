import { useState, useEffect } from "react";
import { fetchUserById, updateUserProfile } from "../services/userService.ts";
import { getUserId, clearAuth, validateUsername } from "../services/authService.ts";
import { getSelectedProject, clearSelectedProject } from "../services/storageService";
import { leaveProject, isProjectOwner, updateProjectOwner, fetchProjectMembers } from "../services/projectService";
import { useNavigate } from "react-router-dom";
import { User } from "../types/hooks";

export interface LeaveProjectState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export interface UseAccountDetailsReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  handleGoBack: () => void;
  handleLogout: () => void;
  handleChangePassword: (newPassword: string) => Promise<boolean>;
  handleLeaveGroup: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<User>;
  getUserProp: (propName: string) => any;
  leaveProjectState: LeaveProjectState;
  reassignOwnershipAndLeave: (projectId: string, newOwnerId: string) => Promise<void>;
}

/**
 * useAccountDetails
 *
 * Manages user profile state, username updates, password changes,
 * and project ownership logic.
 */
const useAccountDetails = (): UseAccountDetailsReturn => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [leaveProjectState, setLeaveProjectState] = useState<LeaveProjectState>({
    loading: false,
    error: null,
    success: null
  });

  useEffect(() => {
    const fetchUserData = async (): Promise<void> => {
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
        
        if (userData && typeof userData === 'object') {
          setUser(userData);
        } else {
          console.error("❌ Invalid user data format:", userData);
          setError("Invalid user data format received.");
        }
      } catch (err: any) {
        console.error("❌ Error fetching user details:", err.message);
        setError("Failed to load account details.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleGoBack = (): void => {
    console.log("🔙 Returning to the previous page...");
    navigate(-1);
  };

  const handleLogout = (): void => {
    console.log("🚪 Logging out...");
    clearAuth();
    navigate("/");
  };

  const getUserProp = (propName: string): any => {
    if (!user) return null;
    
    const lowerProp = propName.toLowerCase();
    if ((user as any)[lowerProp] !== undefined) return (user as any)[lowerProp];
    
    if ((user as any)[propName] !== undefined) return (user as any)[propName];
    
    const capitalizedProp = propName.charAt(0).toUpperCase() + propName.slice(1).toLowerCase();
    if ((user as any)[capitalizedProp] !== undefined) return (user as any)[capitalizedProp];
    
    if ((user as any)[propName.toLowerCase()] !== undefined) return (user as any)[propName.toLowerCase()];
    
    return null;
  };

  const updateUsername = async (newUsername: string): Promise<User> => {
    const userId = getUserProp('id');
    
    if (!userId) {
      console.error("User data is not available:", user);
      throw new Error("User data is not available");
    }

    const currentUsername = getUserProp('username');

    if (newUsername === currentUsername) {
      console.log("✅ Username unchanged, skipping update");
      return user!;
    }

    try {
      console.log(`🔍 Checking if "${newUsername}" is available...`);
      
      const isTaken = await validateUsername(newUsername, currentUsername);
      
      if (isTaken) {
        console.log("❌ Username is already in use, cannot update");
        throw new Error("Username is already in use");
      }
      
      console.log("✅ Username is available, proceeding with update");
      
      const updateData = {
        id: userId,
        ID: userId,
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
      
      const result = await updateUserProfile(updateData, user!);
      console.log("📥 Update successful:", result);
      
      setUser(result);
      return result;
    } catch (err: any) {
      console.error("❌ Error updating username:", err);
      throw err;
    }
  };

  const handleChangePassword = async (newPassword: string): Promise<boolean> => {
    const userId = getUserProp('id');
    
    if (!userId) {
      console.error("User data is not available:", user);
      throw new Error("User data is not available");
    }

    try {
      console.log("🔑 Changing password...");

      const passwordData = {
        id: userId,
        username: getUserProp('username'),
        email: getUserProp('email'),
        firstName: getUserProp('firstName'),
        lastName: getUserProp('lastName'),
        password: newPassword
      };

      const result = await updateUserProfile(passwordData);
      console.log("✅ Password changed successfully");
      
      if (result) {
        setUser(result);
      }
      
      return true;
    } catch (err: any) {
      console.error("❌ Error changing password:", err);
      throw err;
    }
  };

  const handleLeaveGroup = async (): Promise<void> => {
    const selectedProjectId = getSelectedProject();
  
    if (!selectedProjectId) {
      setLeaveProjectState({
        loading: false,
        error: "No project selected. Join or select a project first.",
        success: null
      });
      return;
    }
  
    try {
      setLeaveProjectState({
        loading: true,
        error: null,
        success: null
      });
      
      const isOwner = await isProjectOwner(selectedProjectId);
      
      if (isOwner) {
        setLeaveProjectState({
          loading: false,
          error: "You are the project owner. Please reassign ownership to another member before leaving.",
          success: null
        });
        return;
      }
      
      console.log(`🏃 Leaving project ${selectedProjectId}...`);
      await leaveProject(selectedProjectId);
      
      clearSelectedProject();
      
      setLeaveProjectState({
        loading: false,
        error: null,
        success: "Successfully left the project."
      });
      
      setTimeout(() => {
        setLeaveProjectState(prev => ({...prev, success: null}));
      }, 3000);
      
    } catch (err: any) {
      console.error("❌ Error leaving project:", err);
      setLeaveProjectState({
        loading: false,
        error: err.message || "Failed to leave the project.",
        success: null
      });
    }
  };

  const reassignOwnershipAndLeave = async (projectId: string, newOwnerId: string): Promise<void> => {
    try {
      console.log(`🔄 Reassigning ownership of project ${projectId} to user ${newOwnerId}...`);
      await updateProjectOwner(projectId, newOwnerId);
      console.log("✅ Ownership reassigned successfully. Leaving project...");
      await leaveProject(projectId);
      clearSelectedProject();
      setLeaveProjectState({
        loading: false,
        error: null,
        success: "Successfully reassigned ownership and left the project.",
      });
    } catch (err: any) {
      console.error("❌ Error reassigning ownership or leaving project:", err);
      setLeaveProjectState({
        loading: false,
        error: err.message || "Failed to reassign ownership or leave the project.",
        success: null,
      });
    }
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
    getUserProp,
    leaveProjectState,
    reassignOwnershipAndLeave
  };
};

export default useAccountDetails;

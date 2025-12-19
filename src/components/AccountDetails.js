import React, { useState, useEffect } from "react";
import useAccountDetails from "../hooks/useAccountDetails.ts";
import { useScrollIndicators } from "../hooks/useScrollIndicators.ts";
import "../styles/account_details.css";
import "../styles/create_sprint.css"; // Reuse Sprint page layout + fields
import { getSelectedProject } from "../services/storageService";
import { useProjectMembers } from "../hooks/useProjects.ts";
/**
 * AccountDetails Component
 *
 * Allows users to view and manage account information including:
 * - First name, last name, username, email
 * - Change password
 * - Leave current project (with ownership reassignment if owner)
 * - Logout
 *
 * @hook useAccountDetails - Provides user data and account-related handlers
 * @state showPasswordChange - Toggles visibility of password form
 * @state newPassword - Stores new password input
 * @state confirmPassword - Stores password confirmation input
 * @state passwordError - Tracks password validation or submission errors
 * @state passwordSuccess - Tracks password change success message
 * 
 * @state isEditingUsername - Tracks username edit state
 * @state newUsername - Username input field value
 * @state usernameError - Username update error message
 * @state usernameSuccess - Username update success message
 *
 * @state showLeaveConfirmation - Toggles leave project confirmation section
 * @state projectMembers - Members available for ownership reassignment
 * @state selectedNewOwner - Selected member to reassign ownership to
 * @state reassignError - Reassignment validation or submission error
 *
 * @effect Syncs username field with user context on mount
 * @effect Fetches project members if owner attempts to leave project
 *
 * @function handleUsernameKeyDown - Saves or cancels username edits via Enter or Escape
 * @function submitPasswordChange - Validates and updates password
 * @function confirmLeaveProject - Triggers modal for leaving the project
 * @function handleReassignAndLeave - Reassigns ownership then leaves project
 * @function executeLeaveProject - Leaves the project as non-owner
 *
 * @accessibility All input fields use proper labels or placeholders
 */
const AccountDetails = () => {
  const {
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
    reassignOwnershipAndLeave,
  } = useAccountDetails();

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSuccess, setUsernameSuccess] = useState("");

  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [reassignError, setReassignError] = useState("");

  const selectedProjectId = getSelectedProject();
  const hasSelectedProject = !!selectedProjectId;

  // TanStack Query hook for project members
  const { data: membersData } = useProjectMembers(selectedProjectId);
  
  // Extract and filter members (exclude current user)
  const projectMembers = React.useMemo(() => {
    if (!membersData) return [];
    const members = membersData.members || membersData || [];
    return members.filter((member) => member.id !== user?.id);
  }, [membersData, user?.id]);

  // Use scroll indicators hook for Progressive Disclosure + Affordance
  // Only include dependencies that actually change DOM structure/height
  // Error/success messages don't significantly affect height, so excluded to prevent re-runs on every keystroke
  const containerRef = useScrollIndicators([
    showPasswordChange,      // Form expansion/collapse
    showLeaveConfirmation,   // Confirmation modal visibility
    projectMembers.length,   // Member list changes
    isEditingUsername,      // Username edit mode toggle
    user?.id,                // Re-check when user data loads
  ]);

  useEffect(() => {
    if (user?.Username) {
      setNewUsername(user.Username);
    }
  }, [user]);

  // Members are now loaded via TanStack Query hook above
  // No need for useEffect or fetchMembersForProject function

  const handlePasswordChangeClick = () => {
    setShowPasswordChange(true);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
  };

  const submitPasswordChange = async () => {
    // Reset any previous errors/success
    setPasswordError("");
    setPasswordSuccess("");
    
    // Validate passwords
    if (!newPassword || !confirmPassword) {
      setPasswordError("Both fields are required");
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    
    // Check for special character
    const specialCharacterRegex = /[!@#$%^&*(),.?":{}|<>]/;
    if (!specialCharacterRegex.test(newPassword)) {
      setPasswordError("Password must include at least one special character");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    
    try {
      await handleChangePassword(newPassword);
      setPasswordSuccess("Password changed successfully!");
      // Clear fields and hide form after success
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordSuccess("");
      }, 2000);
    } catch (err) {
      setPasswordError(err.message || "Failed to change password");
    }
  };

  const handleUsernameClick = () => {
    if (isEditingUsername) return; // Prevent double toggle
    setNewUsername(user?.Username || "");
    setIsEditingUsername(true);
    setUsernameError("");
    setUsernameSuccess("");
  };

  const handleUsernameKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      
      // Reset any previous errors/success
      setUsernameError("");
      setUsernameSuccess("");

      // Validate username
      if (!newUsername || newUsername.length < 3) {
        setUsernameError("Username must be at least 3 characters");
        return;
      }
      
      // Skip validation if username hasn't changed
      if (newUsername === user?.Username) {
        setIsEditingUsername(false);
        return;
      }
      
      try {
        // Using the updateUsername function from the hook
        await updateUsername(newUsername);
        
        // Show success message
        setUsernameSuccess("Username updated successfully!");
        setIsEditingUsername(false);
        
        // Clear success message after delay
        setTimeout(() => {
          setUsernameSuccess("");
        }, 2000);
      } catch (err) {
        console.error("Username update error:", err);
        setUsernameError(err.message || "Failed to update username");
      }
    } else if (e.key === "Escape") {
      // Allow users to cancel editing with Escape key
      setIsEditingUsername(false);
      setNewUsername(user?.Username || "");
      setUsernameError("");
    }
  };

  const cancelPasswordChange = () => {
    setShowPasswordChange(false);
    setPasswordError("");
  };

  const confirmLeaveProject = () => {
    setShowLeaveConfirmation(true);
  };

  const handleReassignAndLeave = async () => {
    if (!selectedNewOwner) {
      setReassignError("Please select a new project owner.");
      return;
    }

    setReassignError("");
    try {
      await reassignOwnershipAndLeave(selectedProjectId, selectedNewOwner);
      setShowLeaveConfirmation(false);
    } catch (err) {
      setReassignError(err.message || "Failed to reassign ownership.");
    }
  };

  const executeLeaveProject = async () => {
    try {
      await handleLeaveGroup();
      // The hook will handle clearing the selected project
      setShowLeaveConfirmation(false);
    } catch (err) {
      // Error handling is in the hook
    }
  };

  const cancelLeaveProject = () => {
    setShowLeaveConfirmation(false);
  };

  if (loading) return <p className="loading-spinner">Loading account details...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div ref={containerRef} className="create-sprint-container with-footer-pad"> {/* width clamp ~500px, mobile-first */}
      {/* Apple-style compact header reused from Sprint */}
      <div className="create-sprint-nav-bar">
        <button className="back-nav-btn" onClick={handleGoBack}>Back</button>
        <h1 className="create-sprint-title">Account</h1>
        <div className="nav-spacer" />
      </div>

      <form className="create-sprint-form" onSubmit={(e) => e.preventDefault()}>
        {/* Full name (display only, like before) */}
        <div className="form-group">
          <label className="form-label">Name</label>
          <div className="full-name-display">
            {getUserProp("firstName")} {getUserProp("lastName")}
          </div>
        </div>

        {/* Username (click-to-edit like before) */}
        <div className="form-group">
          <label className="form-label" htmlFor="username">Username</label>
          {isEditingUsername ? (
            <>
              <input
                id="username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                onKeyDown={handleUsernameKeyDown}
                placeholder="Enter new username"
                autoFocus
                className={`form-input ${usernameError ? "input-error" : ""}`}
              />
              {usernameError && (
                <div className="error-message">{usernameError}</div>
              )}
              <small className="helper-text">Press Enter to save or Escape to cancel</small>
            </>
          ) : (
            <input
              type="text"
              value={getUserProp("username") || ""}
              onClick={handleUsernameClick}
              readOnly
              className="form-input editable-field"
              placeholder="Username"
            />
          )}
          {usernameSuccess && (
            <div className="success-popup-account">{usernameSuccess}</div>
          )}
        </div>

        {/* Email (read-only, same as before) */}
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={getUserProp("email") || ""}
            readOnly
            className="form-input"
          />
        </div>

        {/* Change password */}
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          {!showPasswordChange ? (
            <>
              <input type="password" id="password" value="*************" readOnly className="form-input" />
              <div className="form-actions">
                <button type="button" className="secondary-action-btn" onClick={handlePasswordChangeClick}>
                  Change Password
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password"
                className={`form-input ${passwordError ? "input-error" : ""}`}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className={`form-input ${passwordError && newPassword === confirmPassword ? "" : (passwordError ? "input-error" : "")}`}
              />
              {passwordError && <div className="error-message">{passwordError}</div>}
              {passwordSuccess && <div className="success-message">{passwordSuccess}</div>}

              <div className="form-actions">
                <button type="button" className="primary-action-btn" onClick={submitPasswordChange}>Confirm</button>
                <button type="button" className="secondary-action-btn" onClick={cancelPasswordChange}>Cancel</button>
              </div>
            </>
          )}
        </div>

        {/* Leave Project */}
        {hasSelectedProject && (
          <>
            {leaveProjectState.error && (
              <div className="error-message">{leaveProjectState.error}</div>
            )}
            {leaveProjectState.success && (
              <div className="success-message">{leaveProjectState.success}</div>
            )}
          </>
        )}
        <div className="form-actions">
          {hasSelectedProject ? (
            <button type="button" className="danger-action-btn" onClick={confirmLeaveProject}>
              Leave Project
            </button>
          ) : (
            <button type="button" className="danger-action-btn" disabled title="Join or select a project first">
              Leave Project
            </button>
          )}
        </div>

        {showLeaveConfirmation && (
          <div className="leave-project-confirmation">
            {leaveProjectState.error === "You are the project owner. Please reassign ownership to another member before leaving." ? (
              <>
                <div className="warning-message">You are the project owner. Please reassign ownership to another member before leaving.</div>
                <select value={selectedNewOwner} onChange={(e) => setSelectedNewOwner(e.target.value)} className="dropdown">
                  <option value="">Select a new owner</option>
                  {projectMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.username}</option>
                  ))}
                </select>
                {reassignError && <div className="error-message">{reassignError}</div>}
                <div className="form-actions">
                  <button type="button" className="primary-action-btn" onClick={handleReassignAndLeave}>Reassign and Leave</button>
                  <button type="button" className="secondary-action-btn" onClick={cancelLeaveProject}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="warning-message">Are you sure you want to leave this project? Your tasks will be unassigned.</div>
                <div className="form-actions">
                  <button type="button" className="primary-action-btn" onClick={executeLeaveProject}>Yes, Leave Project</button>
                  <button type="button" className="secondary-action-btn" onClick={cancelLeaveProject}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom actions */}
        <div className="form-actions">
          <button type="button" className="secondary-action-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </form>
    </div>
  );
};

export default AccountDetails;

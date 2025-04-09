import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCheck, faTimes, faExclamationCircle, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import useAccountDetails from "../hooks/useAccountDetails";
import "../styles/account_details.css";
import { getSelectedProject } from "../services/storageService";
import { fetchProjectMembers } from "../services/projectService";

const AccountDetails = () => {
  const navigate = useNavigate();
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
  const [projectMembers, setProjectMembers] = useState([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [reassignError, setReassignError] = useState("");

  const selectedProjectId = getSelectedProject();
  const hasSelectedProject = !!selectedProjectId;

  useEffect(() => {
    if (user?.Username) {
      setNewUsername(user.Username);
    }
  }, [user]);

  useEffect(() => {
    if (showLeaveConfirmation && hasSelectedProject) {
      fetchMembersForProject(); // Use a renamed function to avoid confusion
    }
  }, [showLeaveConfirmation, hasSelectedProject]);

  const fetchMembersForProject = async () => {
    try {
      const members = await fetchProjectMembers(selectedProjectId); // Use the imported function
      setProjectMembers(members.filter((member) => member.id !== user?.id)); // Exclude the current user
    } catch (err) {
      console.error("❌ Error fetching project members:", err);
    }
  };

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
    <div className="account-details-page">
      <div className="account-container">
        <div className="account-card">
          <div className="back-arrow" onClick={handleGoBack}>
            <FontAwesomeIcon icon={faArrowRotateLeft} />
          </div>

          <h1>Account Details</h1>

          <div className="profile-placeholder">
            {getUserProp("firstName")?.charAt(0) || ""}
            {getUserProp("lastName")?.charAt(0) || ""}
          </div>

          <div className="full-name-display">
            {getUserProp("firstName")} {getUserProp("lastName")}
          </div>

          {isEditingUsername ? (
            <div className="input-group">
              <input 
                type="text" 
                value={newUsername} 
                onChange={(e) => setNewUsername(e.target.value)}
                onKeyDown={handleUsernameKeyDown}
                placeholder="Enter new username"
                autoFocus
                className={usernameError ? "input-error" : ""}
              />
              {usernameError && (
                <div className="error-message">
                  <FontAwesomeIcon icon={faExclamationCircle} className="error-icon" /> {usernameError}
                </div>
              )}
              <small className="helper-text">Press Enter to save or Escape to cancel</small>
            </div>
          ) : (
            <div className="input-group">
              <input 
                type="text" 
                value={getUserProp('username') || ""} 
                onClick={handleUsernameClick}
                readOnly
                className="editable-field"
                placeholder="Username"
              />
              {usernameSuccess && (
                <div className="success-popup-account">
                  <FontAwesomeIcon icon={faCheck} className="success-icon" />
                  {usernameSuccess}
                </div>
                )}
            </div>
          )}

          <input 
            type="email" 
            value={getUserProp('email') || ""} 
            readOnly 
            placeholder="Email" 
          />

          {showPasswordChange ? (
            <div className="password-change-section">
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password" 
                className={passwordError ? "input-error" : ""}
              />
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password" 
                className={passwordError && newPassword === confirmPassword ? "" : (passwordError ? "input-error" : "")}
              />
              
              {passwordError && (
                <div className="error-message">
                  <FontAwesomeIcon icon={faExclamationCircle} className="error-icon" /> {passwordError}
                </div>
              )}
              {passwordSuccess && <div className="success-message">{passwordSuccess}</div>}
              
              <div className="password-actions">
                <button className="confirm-btn" onClick={submitPasswordChange}>
                  <FontAwesomeIcon icon={faCheck} /> Confirm
                </button>
                <button className="cancel-btn" onClick={cancelPasswordChange}>
                  <FontAwesomeIcon icon={faTimes} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <input type="password" value="*************" readOnly placeholder="Password" />
              <button className="change-password-btn" onClick={handlePasswordChangeClick}>
                Change Password
              </button>
            </>
          )}

          {/* Leave Project Section */}
          {hasSelectedProject ? (
            <>
              <button
                className="leave-group-btn"
                onClick={confirmLeaveProject}
              >
                Leave Project
              </button>
              {leaveProjectState.error && (
                <div className="error-message">
                  <FontAwesomeIcon icon={faExclamationCircle} /> {leaveProjectState.error}
                </div>
              )}
              {leaveProjectState.success && (
                <div className="success-message">
                  {leaveProjectState.success}
                </div>
              )}
            </>
          ) : (
            <button
              className="leave-group-btn disabled"
              disabled
              title="Join or select a project first"
            >
              Leave Project
            </button>
          )}

          {showLeaveConfirmation && (
            <div className="leave-project-confirmation">
              {leaveProjectState.error === "You are the project owner. Please reassign ownership to another member before leaving." ? (
                <>
                  <div className="warning-message">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
                    You are the project owner. Please reassign ownership to another member before leaving.
                  </div>
                  <select
                    value={selectedNewOwner}
                    onChange={(e) => setSelectedNewOwner(e.target.value)}
                    className="dropdown"
                  >
                    <option value="">Select a new owner</option>
                    {projectMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.username}
                      </option>
                    ))}
                  </select>
                  {reassignError && (
                    <div className="error-message">
                      <FontAwesomeIcon icon={faExclamationCircle} /> {reassignError}
                    </div>
                  )}
                  <div className="confirmation-actions">
                    <button className="confirm-leave-btn" onClick={handleReassignAndLeave}>
                      Reassign and Leave
                    </button>
                    <button className="cancel-btn" onClick={cancelLeaveProject}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="warning-message">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="warning-icon" />
                    Are you sure you want to leave this project? Your tasks will be unassigned.
                  </div>
                  <div className="confirmation-actions">
                    <button className="confirm-leave-btn" onClick={executeLeaveProject}>
                      Yes, Leave Project
                    </button>
                    <button className="cancel-btn" onClick={cancelLeaveProject}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
};

export default AccountDetails;

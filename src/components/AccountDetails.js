import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCheck, faTimes, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";
import useAccountDetails from "../hooks/useAccountDetails";
import "../styles/account_details.css";
import { getSelectedProject } from "../services/storageService";

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
    getUserProp  // Add this
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
  
  // Check for selected project
  const selectedProjectId = getSelectedProject();
  const hasSelectedProject = !!selectedProjectId;

  // Update the username field when user data loads
  useEffect(() => {
    if (user?.Username) {
      setNewUsername(user.Username);
    }
  }, [user]);

  // Debug logging
  useEffect(() => {
    console.log("Current user data:", user);
  }, [user]);

  if (loading) return <p className="loading-spinner">Loading account details...</p>;
  if (error) return <p className="error">{error}</p>;

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

  return (
    <div className="account-container">
      <div className="account-card">
        <div className="back-arrow" onClick={handleGoBack}>
          <FontAwesomeIcon icon={faArrowRotateLeft} />
        </div>

        <h1>Account Details</h1>

        <div className="profile-placeholder">
          {getUserProp('firstName')?.charAt(0) || ""}
          {getUserProp('lastName')?.charAt(0) || ""}
        </div>

        <div className="full-name-display">
          {getUserProp('firstName')} {getUserProp('lastName')}
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
            {usernameSuccess && <div className="success-message">{usernameSuccess}</div>}
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

        {/* Conditionally display the Leave Group button based on project selection */}
        {hasSelectedProject ? (
          <button
            className="leave-group-btn"
            onClick={handleLeaveGroup}
          >
            Leave Group
          </button>
        ) : (
          <button
            className="leave-group-btn disabled"
            disabled
            title="Join or select a project first"
          >
            Leave Group
          </button>
        )}

        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
};

export default AccountDetails;

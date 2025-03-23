import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft, faCheck, faTimes } from "@fortawesome/free-solid-svg-icons";
import useAccountDetails from "../hooks/useAccountDetails";
import "../styles/account_details.css";

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
    updateUsername
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

  if (loading) return <p>Loading account details...</p>;
  if (error) return <p className="error">{error}</p>;

  const handlePasswordChangeClick = () => {
    setShowPasswordChange(true);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
  };

  const submitPasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      setPasswordError("Both fields are required");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }

    try {
      await handleChangePassword(newPassword);
      setPasswordSuccess("Password changed successfully!");
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordSuccess("");
      }, 2000);
    } catch (err) {
      setPasswordError(err.message || "Failed to change password");
    }
  };

  const handleUsernameClick = () => {
    if (isEditingUsername) return; // ✅ Prevent double toggle
    setNewUsername(user?.username || "");
    setIsEditingUsername(true);
    setUsernameError("");
    setUsernameSuccess("");
  };

  const handleUsernameKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur(); // ✅ Optional: blur input after submitting

      if (!newUsername || newUsername.length < 3) {
        setUsernameError("Username must be at least 3 characters");
        return;
      }

      try {
        await updateUsername(newUsername);
        setUsernameSuccess("Username updated successfully!");
        setIsEditingUsername(false);   // ✅ Exit edit mode
        setNewUsername("");            // ✅ Clear edit state
        setUsernameError("");

        setTimeout(() => {
          setUsernameSuccess("");
        }, 2000);
      } catch (err) {
        setUsernameError(err.message || "Failed to update username");
      }
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
          {user?.firstName?.charAt(0) || ""}
          {user?.lastName?.charAt(0) || ""}
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
            />
            {usernameError && <div className="error-message">{usernameError}</div>}
            <small className="helper-text">Press Enter to save</small>
          </div>
        ) : (
          <div className="input-group">
            <input
              type="text"
              value={user?.username || ""}
              onClick={handleUsernameClick}
              readOnly
              className="editable-field"
            />
            {usernameSuccess && <div className="success-message">{usernameSuccess}</div>}
          </div>
        )}

        <input type="email" value={user?.email || ""} readOnly placeholder="Email" />

        {showPasswordChange ? (
          <div className="password-change-section">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
            />
            {passwordError && <div className="error-message">{passwordError}</div>}
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

        <button className="leave-group-btn" onClick={handleLeaveGroup}>Leave Group</button>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
};

export default AccountDetails;

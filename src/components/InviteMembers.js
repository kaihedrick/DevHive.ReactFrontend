import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { getSelectedProject } from "../services/storageService";
import "../styles/invite_members.css";
import DevHiveLogo from "./assets/DevHiveLogo.png";
/**
 * InviteMembers Component
 * 
 * Displays the selected project ID as an invite code.
 * Allows users to copy the invite code to their clipboard.
 * Used for sharing with other users to join the project.
 */
const InviteMembers = () => {
  /**
   * useNavigate
   * 
   * Used to navigate back to the previous screen using the history stack
   */
  const navigate = useNavigate();
  /**
   * getSelectedProject
   * 
   * Retrieves the selected project ID (used as invite code) from localStorage
   */
  const inviteCode = getSelectedProject(); // Get project GUID from localStorage
  /**
   * useState - copied
   * 
   * copied: Tracks whether the invite code has been copied to clipboard
   */
  const [copied, setCopied] = useState(false);
  /**
   * handleCopy
   * 
   * Copies the invite code to clipboard and shows a temporary success message
   * 
   * @returns {void}
   */
  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);

    // Hide the message after 3 seconds
    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };

  return (
    <div className="invite-members">
      <div className="invite-container">
        {/* Back Arrow */}
        <div className="back-arrow" onClick={() => navigate(-1)}>
          <FontAwesomeIcon icon={faArrowRotateLeft} />
        </div>

        {/* DevHive Logo */}
        <div className="logo">
          <img src={DevHiveLogo} alt="DevHive Logo" />
        </div>

        {/* Invite Code Section */}
        <h2>Invite Code</h2>
        <p>Share with new members</p>

        <input
          type="text"
          value={inviteCode || "No Invite Code Available"}
          readOnly
          className="invite-code"
        />

        <button className="copy-button" onClick={handleCopy}>
          Copy Code
        </button>

        {/* Copy Success Message */}
        {copied && <div className="copy-message">Copied to clipboard! ✅</div>}
      </div>
    </div>
  );
};

export default InviteMembers;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSelectedProject } from '../services/storageService';
import "../styles/invite_members.css";
import DevHiveLogo from './assets/DevHiveLogo.png';

const InviteMembers = () => {
  const navigate = useNavigate();
  const inviteCode = getSelectedProject(); // Get project GUID from localStorage
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);

    // Hide the message after 3 seconds
    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };

  return (
    <div className="invite-container">
      {/* DevHive Logo */}
      <div className="logo">
        <img src={DevHiveLogo} alt="DevHive Logo" />
      </div>

      {/* Back Button */}
      <div className="back-button" onClick={() => navigate(-1)}>
        ←
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
            {/* Copy Success Message (Only Shows When `copied` is true) */}
            {copied && <div className="copy-message">Copied to clipboard! ✅</div>}
    </div>
  );
};

export default InviteMembers;

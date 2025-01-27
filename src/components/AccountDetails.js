import React, { useState, useEffect } from "react";
import { getSelectedProject } from "../services/projectService";
import { useNavigate } from "react-router-dom";
import "../styles/account.css";

const AccountDetails = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    username: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    setUser({
      username: "johndoe",
      email: "johndoe@example.com",
      password: "********",
    });
  }, []);

  const handleLeaveGroup = () => {
    const selectedProjectId = getSelectedProject();
    if (!selectedProjectId) {
      alert("A project hasn't been selected yet.");
      return;
    }
    console.log("Leaving group...");
  };

  return (
    <div className="account-container">
      <h1>Account Details</h1>

      <div className="profile-placeholder"></div>

      <input type="text" value={user.username} readOnly placeholder="Username" />
      <input type="email" value={user.email} readOnly placeholder="Email" />
      <input type="password" value={user.password} readOnly placeholder="Password" />

      <button className="change-password-btn">Change Password</button>
      <button className="leave-group-btn" onClick={handleLeaveGroup}>Leave Group</button>
      <button className="logout-btn" onClick={() => navigate("/login")}>Logout</button>
    </div>
  );
};

export default AccountDetails;

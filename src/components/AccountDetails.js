import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"; 
import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons"; 
import useAccountDetails from "../hooks/useAccountDetails";
import "../styles/account_details.css";

const AccountDetails = () => {
  const navigate = useNavigate();
  const { user, loading, error, handleGoBack, handleLogout, handleChangePassword, handleLeaveGroup } = useAccountDetails();

  if (loading) return <p>Loading account details...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="account-container">
      {/* Back Arrow (Styled like in Create Project) */}
      <div className="back-arrow" onClick={handleGoBack}>
        <FontAwesomeIcon icon={faArrowRotateLeft} />
      </div>

      <div className="account-card">
        <h1>Account Details</h1>


        <input type="text" value={user?.username || ""} readOnly placeholder="Username" />
        <input type="email" value={user?.email || ""} readOnly placeholder="Email" />
        <input type="password" value="*************" readOnly placeholder="Password" />

        <button className="change-password-btn" onClick={handleChangePassword}>Change Password</button>
        <button className="leave-group-btn" onClick={handleLeaveGroup}>Leave Group</button>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
};

export default AccountDetails;

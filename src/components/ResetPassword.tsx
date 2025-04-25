// src/components/ResetPassword.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/forgot_password.css";
import DevHiveLogo from "./assets/DevHiveLogo.png";
import password_icon from "./assets/password.png";
import { resetPassword } from "../services/authService";
/**
 * ResetPassword component handles password reset flow
 * 
 * @component
 * @returns {JSX.Element} A page for users to reset their password using a reset token
 * 
 * @description 
 * - Extracts token from URL query parameters
 * - Validates and submits a new password
 * - Handles user feedback for errors and success
 * - Automatically scrolls and resets state after update
 */

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Modern way to get query params in React Router v6
    const queryParams = new URLSearchParams(location.search);
    let tokenFromUrl = queryParams.get("token");
    
    if (tokenFromUrl) {
      // Don't manually replace anything, just set the token directly
      // This preserves the token exactly as it appears in the URL
      setToken(tokenFromUrl);
      
      console.log("Original token from URL:", tokenFromUrl);
    } else {
      setError("Invalid password reset link. Please request a new one.");
    }
  }, [location]);
  
  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value);
    setError("");
  };
  
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    setError("");
  };
  
  const handleGoBack = () => {
    navigate("/");
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Password constraints
    const specialCharacterRegex = /[!@#$%^&*(),.?":{}|<>]/;
    
    // Validation
    if (!newPassword) {
      setError("New password is required");
      return;
    }
    
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    if (!specialCharacterRegex.test(newPassword)) {
      setError("Password must include at least one special character");
      return;
    }
    
    if (!confirmPassword) {
      setError("Please confirm your password");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    try {
      // The token may have + or other URL-encoded characters
      // Send it exactly as it came from the URL
      console.log("Token before sending:", token);
      
      await resetPassword({
        Token: token,
        NewPassword: newPassword
      });
      
      setSuccess(true);
      setError("");
    } catch (err: any) {
      console.error("❌ Error resetting password:", err);
      
      // Better error handling for different types of errors
      if (err.response?.data) {
        // If the server returns a string error message
        setError(typeof err.response.data === 'string' 
          ? err.response.data 
          : "An error occurred while resetting your password");
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("An error occurred while resetting your password");
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="background">
      {/* Logo Section */}
      <div className="logo-container">
        <img src={DevHiveLogo} alt="DevHive Logo" className="devhive-logo" />
        <h1 className="logo-text">DevHive</h1>
      </div>
      
      {/* Form Section */}
      <div className="container">
        <div className="header">
          <div className="text">Reset Your Password</div>
          <div className="underline"></div>
        </div>
        
        {!token && (
          <div className="error-message">
            <p>{error}</p>
            <button className="back-button" onClick={handleGoBack}>
              Back to Login
            </button>
          </div>
        )}
        
        {token && success ? (
          <div className="success-message">
            <p>Password Reset Successful!</p>
            <p>Your password has been updated. You can now login with your new password.</p>
            <button className="back-button" onClick={handleGoBack}>
              Back to Login
            </button>
          </div>
        ) : token && (
          <>
            <p className="reset-instructions">
              Please enter your new password.
            </p>
            
            <div className="inputs">
              <div className="input-field">
                <img src={password_icon} alt="" className="input-icon" />
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                />
              </div>
              
              <div className="input-field">
                <img src={password_icon} alt="" className="input-icon" />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                />
              </div>
            </div>
            
            {error && <p className="error">{error}</p>}
            
            <div className="submit-container">
              <button
                className="reset-button"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
              <button className="back-button" onClick={handleGoBack}>
                Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
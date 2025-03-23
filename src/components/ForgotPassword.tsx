// src/components/ForgotPassword.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/forgot_password.css";
import DevHiveLogo from "./assets/DevHiveLogo.png";
import email_icon from "./assets/email.png";
import { requestPasswordReset } from "../services/authService.ts"; // Remove .ts extension

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError("");
  };

  const handleGoBack = () => {
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!email) {
      setError("Email is required");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSuccess(true);
      setError("");
    } catch (err: any) {
      console.error("❌ Error requesting password reset:", err);
      
      // Improved error handling - FIXED to extract string messages
      if (err.response) {
        const status = err.response.status;
        if (status === 404) {
          setError("Email not found. Please check your email address.");
        } else if (status === 500) {
          // Extract error message from response data if it's an object
          if (typeof err.response.data === 'object') {
            // Try to extract a usable error message
            if (err.response.data.title) {
              setError(err.response.data.title);
            } else if (err.response.data.message) {
              setError(err.response.data.message);
            } else if (err.response.data.error) {
              setError(err.response.data.error);
            } else {
              setError("Server error. Please try again later.");
            }
          } else {
            // If it's already a string, use it directly
            setError(err.response.data || "Server error. Please try again later.");
          }
        } else {
          // Handle other status codes with object checking
          if (typeof err.response.data === 'object') {
            setError("An error occurred. Please try again.");
          } else {
            setError(err.response.data || "An error occurred. Please try again.");
          }
        }
      } else if (err.message) {
        // Network errors usually have a message property
        setError(err.message);
      } else {
        setError("Network error. Please check your connection.");
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
          <div className="text">Reset Password</div>
          <div className="underline"></div>
        </div>

        {success ? (
          <div className="success-message">
            <p>Password reset email sent!</p>
            <p>Please check your inbox for instructions to reset your password.</p>
            <button className="back-button" onClick={handleGoBack}>
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="reset-instructions">
              Enter your email address and we'll send you instructions to reset your password.
            </p>

            <div className="inputs">
              <div className="input-field">
                <img src={email_icon} alt="" className="input-icon" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Make sure error is always a string */}
            {error && <p className="error">{typeof error === 'object' ? JSON.stringify(error) : error}</p>}

            <div className="submit-container">
              <button
                type="submit"
                className="reset-button"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <button 
                type="button"
                className="back-button" 
                onClick={handleGoBack}
                disabled={loading}
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
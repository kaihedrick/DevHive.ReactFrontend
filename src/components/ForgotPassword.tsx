// src/components/ForgotPassword.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/forgot_password.css";
import { ReactComponent as DevHiveLogo } from "./assets/hive-icon.svg";
import { faEnvelope, faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { requestPasswordReset } from "../services/authService.ts";
/**
 * ForgotPassword Component
 * 
 * Renders a form for users to request a password reset email.
 * Handles email validation, loading state, and user feedback.
 * 
 * @returns {JSX.Element} ForgotPassword form component
 * 
 * @state email - User input email address
 * @state error - Error message to be displayed
 * @state success - Flag indicating if the request was successful
 * @state loading - Loading state for submit action
 * 
 * @method handleEmailChange - Updates email and clears error on change
 * @method handleGoBack - Navigates user back to the login screen
 * @method handleSubmit - Validates email and triggers reset request
 */
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
    navigate("/"); // Navigate back to the login page
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

      if (err.response) {
        const status = err.response.status;
        if (status === 404) {
          setError("Email not found. Please check your email address.");
        } else if (status === 500) {
          if (typeof err.response.data === "object") {
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
            setError(err.response.data || "Server error. Please try again later.");
          }
        } else {
          if (typeof err.response.data === "object") {
            setError("An error occurred. Please try again.");
          } else {
            setError(err.response.data || "An error occurred. Please try again.");
          }
        }
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Network error. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="background">
        <div className="logo-container">
          <DevHiveLogo className="devhive-logo" />
          <h1 className="logo-text">DevHive</h1>
        </div>
        <div className="container">
          {/* Back Arrow */}
          <div className="back-arrow" onClick={handleGoBack}>
            <FontAwesomeIcon icon={faArrowRotateLeft} />
          </div>

          <div className="header">
            <div className="text">Reset Password</div>
            <div className="underline"></div>
          </div>

          {success ? (
            <div className="success-message">
              <p>Password reset email sent!</p>
              <p>Please check your inbox for instructions to reset your password.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="reset-instructions">
                Enter your email address and we'll send you instructions to reset your password.
              </p>

              <div className="inputs">
                <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={loading}
                />
              </div>

              {error && <p className="error">{error}</p>}

              <div className="submit-container">
                <button
                  type="submit"
                  className="reset-button"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
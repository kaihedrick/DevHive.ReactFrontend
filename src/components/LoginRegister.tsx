// src/components/LoginRegister.tsx
import React, { useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import "../styles/login_register.css";
import DevHiveLogo from "./assets/DevHiveLogo.png";
import email_icon from "./assets/email.png";
import password_icon from "./assets/password.png";
import user_icon from "./assets/person.png";
import useLoginRegisterNew from "../hooks/useLoginRegisterNew.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation.ts";
import InputField from "./InputField";
import SubmitButton from "./SubmitButton";

const LoginRegister: React.FC = () => {
  const navigate = useNavigate(); 
  
  const {
    action,
    credentials,
    validationErrors,
    error,
    success,
    loading,
    handleChange,
    handleButtonClick,
    emailValidationStatus
  } = useLoginRegisterNew();

  // Build navigation maps for different form modes
  const signupNavigationMap = useMemo(() => ({
    FirstName: "LastName",
    LastName: "Email",
    Email: "Username",
    Username: "Password",
    Password: "ConfirmPassword",
    ConfirmPassword: ""  // Empty string indicates last field
  }), []);

  const loginNavigationMap = useMemo(() => ({
    Username: "Password",
    Password: ""  // Empty string indicates last field
  }), []);

  // Select the appropriate navigation map based on current mode
  const navigationMap = useMemo(() => 
    action === "Sign Up" ? signupNavigationMap : loginNavigationMap,
  [action, signupNavigationMap, loginNavigationMap]);

  // Create submit handler callback
  const handleSubmit = useCallback(() => {
    handleButtonClick(action);
  }, [action, handleButtonClick]);

  // Use our custom hook for keyboard navigation
  const handleKeyNavigation = useKeyboardNavigation(navigationMap, handleSubmit);

  // Auto-focus the first field when component mounts or when action changes
  useEffect(() => {
    if (action === "Sign Up") {
      document.querySelector<HTMLInputElement>('input[name="FirstName"]')?.focus();
    } else {
      document.querySelector<HTMLInputElement>('input[name="Username"]')?.focus();
    }
  }, [action]);

  const memoizedEmailValidationStatus = useMemo(() => emailValidationStatus, [emailValidationStatus]);

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
          <div className="text">{action === "Login" ? "Welcome Back" : "Sign Up"}</div>
          <div className="underline"></div>
        </div>
        
        {/* Input Fields */}
        <div className="inputs">
          {action === "Sign Up" && (
            <>
              <InputField
                icon={user_icon}
                type="text"
                name="FirstName"
                placeholder="First Name"
                value={credentials.FirstName || ''}
                onChange={handleChange}
                error={validationErrors.FirstName || ''}
                emailValidationStatus={null}
                onKeyDown={(e) => handleKeyNavigation(e, "FirstName")}
              />
              <InputField
                icon={user_icon}
                type="text"
                name="LastName"
                placeholder="Last Name"
                value={credentials.LastName || ''}
                onChange={handleChange}
                error={validationErrors.LastName || ''}
                emailValidationStatus={null}
                onKeyDown={(e) => handleKeyNavigation(e, "LastName")}
              />
              <InputField
                icon={email_icon}
                type="email"
                name="Email"
                placeholder="Email"
                value={credentials.Email || ''}
                onChange={handleChange}
                error={validationErrors.Email || ''}
                emailValidationStatus={memoizedEmailValidationStatus}
                onKeyDown={(e) => handleKeyNavigation(e, "Email")}
              />
            </>
          )}
          <InputField
            icon={user_icon}
            type="text"
            name="Username"
            placeholder="Username"
            value={credentials.Username || ''}
            onChange={handleChange}
            error={validationErrors.Username || ''}
            emailValidationStatus={null}
            onKeyDown={(e) => handleKeyNavigation(e, "Username")}
          />
          <InputField
            icon={password_icon}
            type="password"
            name="Password"
            placeholder="Password"
            value={credentials.Password || ''}
            onChange={handleChange}
            error={validationErrors.Password || ''}
            emailValidationStatus={null}
            onKeyDown={(e) => handleKeyNavigation(e, "Password")}
          />
          {action === "Sign Up" && (
            <InputField
              icon={password_icon}
              type="password"
              name="ConfirmPassword"
              placeholder="Confirm Password"
              value={credentials.ConfirmPassword || ''}
              onChange={handleChange}
              error={validationErrors.ConfirmPassword || ''}
              emailValidationStatus={null}
              onKeyDown={(e) => handleKeyNavigation(e, "ConfirmPassword")}
            />
          )}
        </div>

        {action === "Login" && (
          <div className="forgot-password">
            <span onClick={() => navigate("/forgot-password")}>Forgot Password?</span>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{action} successful!</p>}

        <div className="submit-container">
          <div 
            className={`submit ${action === "Sign Up" ? "" : "gray"}`}
            onClick={() => handleButtonClick("Sign Up")}
          >
            Sign Up
          </div>
          <div 
            className={`submit ${action === "Login" ? "" : "gray"}`}
            onClick={() => handleButtonClick("Login")}
          >
            Login
          </div>
        </div>
        {loading && <div className="loading-spinner">Loading...</div>}
      </div>
    </div>
  );
};

export default LoginRegister;
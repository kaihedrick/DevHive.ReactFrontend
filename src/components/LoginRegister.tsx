// src/components/LoginRegister.tsx
import React, { useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import "../styles/login_register.css";
import { ReactComponent as DevHiveLogo } from "./assets/hive-icon.svg";
import { faEnvelope, faLock, faUser, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import useLoginRegisterNew from "../hooks/useLoginRegisterNew.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation.ts";
/**
 * LoginRegister Component
 * 
 * Handles both login and registration views in a unified form.
 * Supports real-time email validation, field navigation via keyboard, and visual validation feedback.
 * 
 * @returns {JSX.Element} Rendered login/register interface
 */
const LoginRegister: React.FC = () => {
  /**
   * useNavigate
   * 
   * Provides navigation actions for form redirects and route transitions
   */
  const navigate = useNavigate();
  /**
   * useLoginRegisterNew
   * 
   * Custom hook that encapsulates authentication state, field validation, error handling, and form logic
   * 
   * @returns {Object} - login/register state and handlers
   */
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
  /**
   * useMemo - signupNavigationMap / loginNavigationMap
   * 
   * Field navigation mappings used for keyboard-based tabbing and form progression
   */
  const signupNavigationMap = useMemo(() => ({
    FirstName: "LastName",
    LastName: "Email",
    Email: "Username",
    Username: "Password",
    Password: "ConfirmPassword",
    ConfirmPassword: ""
  }), []);

  const loginNavigationMap = useMemo(() => ({
    Username: "Password",
    Password: ""
  }), []);

  const navigationMap = useMemo(() =>
    action === "Sign Up" ? signupNavigationMap : loginNavigationMap,
  [action]);

  const handleSubmit = useCallback(() => {
    handleButtonClick(action);
  }, [action, handleButtonClick]);
  /**
   * useKeyboardNavigation
   * 
   * Hook that manages keyboard-driven navigation between input fields and form submission
   */
  const handleKeyNavigation = useKeyboardNavigation(navigationMap, handleSubmit);
  /**
   * useEffect - Autofocus Field
   * 
   * Automatically focuses the first field when the component mounts or when the form type switches
   * 
   * @dependencies [action]
   */
  useEffect(() => {
    const fieldName = action === "Sign Up" ? "FirstName" : "Username";
    document.querySelector<HTMLInputElement>(`input[name="${fieldName}"]`)?.focus();
  }, [action]);

  const memoizedEmailValidationStatus = useMemo(() => emailValidationStatus, [emailValidationStatus]);
  /**
   * renderInput
   * 
   * Reusable function that renders an input field with icons, error messages, and optional validation indicators
   * 
   * @param {IconDefinition} icon - FontAwesome icon
   * @param {string} name - Input field name
   * @param {string} placeholder - Placeholder text
   * @param {string} type - Input type (text, password, etc.)
   * @param {boolean} validationIcon - Whether to display success/error icons
   * @returns {JSX.Element}
   */
  const renderInput = (
    icon: any,
    name: string,
    placeholder: string,
    type: string,
    validationIcon: boolean = false
  ) => (
    <div className="input-group">
      <div className="input-with-icon">
        <FontAwesomeIcon icon={icon} className="input-icon" />
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          value={credentials[name] || ''}
          onChange={handleChange}
          onKeyDown={(e) => handleKeyNavigation(e, name)}
          className="input-field-base"
        />
        {validationIcon && memoizedEmailValidationStatus === 'success' && (
          <FontAwesomeIcon icon={faCheckCircle} className="validation-icon success" />
        )}
        {validationIcon && memoizedEmailValidationStatus === 'error' && (
          <FontAwesomeIcon icon={faTimesCircle} className="validation-icon error" />
        )}
      </div>
      {validationErrors[name] && (
        <p className="error-message">{validationErrors[name]}</p>
      )}
    </div>
  );

  return (
    <div className="login-register-page">
      <div className="background">
        <div className="logo-container">
          <DevHiveLogo className="devhive-logo" />
          <h1 className="logo-text">DevHive</h1>
        </div>

        <div className="container">
          <div className="header">
            <div className="text">{action === "Login" ? "Welcome Back" : "Sign Up"}</div>
            <div className="underline"></div>
          </div>

          <div className="inputs-section">
            {action === "Sign Up" && (
              <>
                {renderInput(faUser, "FirstName", "First Name", "text")}
                {renderInput(faUser, "LastName", "Last Name", "text")}
                {renderInput(faEnvelope, "Email", "Email", "email", true)}
              </>
            )}
            {renderInput(faUser, "Username", "Username", "text")}
            {renderInput(faLock, "Password", "Password", "password")}
            {action === "Sign Up" && renderInput(faLock, "ConfirmPassword", "Confirm Password", "password")}
          </div>

          {action === "Login" && (
            <div className="forgot-password">
              <span onClick={() => navigate("/forgot-password")}>Forgot Password?</span>
            </div>
          )}

          {error && <p className="error">{error}</p>}
          {success && (
            <p className="success">
              {action === "Sign Up" ? "Registration successful!" : "Login successful!"}
            </p>
          )}

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
    </div>
  );
};

export default LoginRegister;

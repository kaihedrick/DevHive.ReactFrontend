// src/components/LoginRegister.tsx
import React, { useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import "../styles/login_register.css";
import { ReactComponent as DevHiveLogo } from "./assets/hive-icon.svg";
import { faEnvelope, faLock, faUser, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import useLoginRegisterNew from "../hooks/useLoginRegisterNew.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation.ts";

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

  const handleKeyNavigation = useKeyboardNavigation(navigationMap, handleSubmit);

  useEffect(() => {
    const fieldName = action === "Sign Up" ? "FirstName" : "Username";
    document.querySelector<HTMLInputElement>(`input[name="${fieldName}"]`)?.focus();
  }, [action]);

  const memoizedEmailValidationStatus = useMemo(() => emailValidationStatus, [emailValidationStatus]);

  const renderInput = (
    icon: any,
    name: string,
    placeholder: string,
    type: string,
    validationIcon: boolean = false
  ) => (
    <div className="input-group">
      <div className="inputs">
        <FontAwesomeIcon icon={icon} className="input-icon" />
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          value={credentials[name] || ''}
          onChange={handleChange}
          onKeyDown={(e) => handleKeyNavigation(e, name)}
        />
        {validationIcon && memoizedEmailValidationStatus === 'success' && (
          <FontAwesomeIcon icon={faCheckCircle} className="validation-icon success-icon" />
        )}
        {validationIcon && memoizedEmailValidationStatus === 'error' && (
          <FontAwesomeIcon icon={faTimesCircle} className="validation-icon error-icon" />
        )}
      </div>
      {validationErrors[name] && (
        <p className="error-message">{validationErrors[name]}</p>
      )}
    </div>
  );

  return (
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

// src/components/LoginRegister.tsx
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import "../styles/login_register.css";
import "../styles/project_details.css"; // For char-count styling
import { ReactComponent as DevHiveLogo } from "./assets/hive-icon.svg";
import { faEnvelope, faLock, faUser, faCheckCircle, faTimesCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import useLoginRegisterNew from "../hooks/useLoginRegisterNew.ts";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation.ts";
import { initiateGoogleOAuth } from "../services/authService.ts";
import { isIOSSafari } from "../utils/isIOSSafari.ts";
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
    successType,
    loading,
    rememberMe,
    handleChange,
    handleButtonClick,
    handleRememberMeChange,
    emailValidationStatus,
    emailValidationError,
    emailValidationAvailable
  } = useLoginRegisterNew();
  
  const [googleOAuthLoading, setGoogleOAuthLoading] = useState(false);
  
  // Detect iOS Safari for Remember Me handling
  const iosSafari = isIOSSafari();
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
   * handleGoogleLogin
   * 
   * Initiates Google OAuth login flow by redirecting to Google authorization page
   */
  const handleGoogleLogin = useCallback(async () => {
    try {
      setGoogleOAuthLoading(true);
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const { authUrl } = await initiateGoogleOAuth(rememberMe, redirectUrl);
      
      // Redirect to Google OAuth page
      window.location.href = authUrl;
    } catch (err: any) {
      setGoogleOAuthLoading(false);
      console.error('❌ Google OAuth initiation error:', err);
      // Error will be shown via the error state if needed
    }
  }, [rememberMe]);
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
  ) => {
    const isPasswordField = type === 'password';
    const isFirstName = name === 'FirstName';
    const isLastName = name === 'LastName';
    const isUsername = name === 'Username';
    const isEmail = name === 'Email';
    const isTextField = type === 'text' && (isFirstName || isLastName || isUsername);
    const fieldValue = credentials[name] || '';
    
    // Determine maxLength based on field type
    let maxLength: number | undefined;
    let charLimit: number | undefined;
    if (isPasswordField) {
      maxLength = 32;
      charLimit = 32;
    } else if (isFirstName || isLastName) {
      maxLength = 20;
      charLimit = 20;
    } else if (isUsername) {
      maxLength = 30;
      charLimit = 30;
    } else if (isEmail) {
      maxLength = 50;
      charLimit = 50;
    }
    
    return (
      <div className="input-group">
        <div className="inputs">
          <FontAwesomeIcon icon={icon} className="input-icon" />
          <input
            type={type}
            name={name}
            placeholder={placeholder}
            value={fieldValue}
            onChange={handleChange}
            onKeyDown={(e) => handleKeyNavigation(e, name)}
            maxLength={maxLength}
            className={charLimit !== undefined ? 'has-char-counter' : ''}
          />
          {validationIcon && memoizedEmailValidationStatus === 'validating' && (
            <FontAwesomeIcon icon={faSpinner} className="validation-icon validating-icon" spin />
          )}
          {validationIcon && memoizedEmailValidationStatus === 'success' && (
            <FontAwesomeIcon icon={faCheckCircle} className="validation-icon success-icon" />
          )}
          {validationIcon && memoizedEmailValidationStatus === 'error' && (
            <FontAwesomeIcon icon={faTimesCircle} className="validation-icon error-icon" />
          )}
          {charLimit !== undefined && (
            <div className="char-counter">
              {fieldValue.length}/{charLimit}
            </div>
          )}
        </div>
        {validationErrors[name] && (
          <p className="error-message">{validationErrors[name]}</p>
        )}
        {name === 'Email' && action === 'Sign Up' && credentials.Email && !validationErrors[name] && (
          <>
            {emailValidationStatus === 'validating' && (
              <p className="validation-message" style={{ color: 'var(--text-secondary)' }}>Checking email...</p>
            )}
            {emailValidationStatus === 'success' && emailValidationAvailable && (
              <p className="validation-message" style={{ color: 'var(--success-color, #4caf50)' }}>✓ Email is available</p>
            )}
            {emailValidationStatus === 'error' && emailValidationError && (
              <p className="validation-message" style={{ color: 'var(--error-color, #f44336)' }}>
                {emailValidationError === 'Email is already taken' ? 'Email is already in use' : emailValidationError}
              </p>
            )}
          </>
        )}
      </div>
    );
  };

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
            <div className="login-options-container">
              <div className="forgot-password">
                <span onClick={() => navigate("/forgot-password")}>Forgot Password?</span>
              </div>
              
              {/* Remember Me Checkbox */}
              <div className="remember-me-container">
                <label className="remember-me-label">
                  <div className="remember-me-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={rememberMe || iosSafari}
                      disabled={iosSafari}
                      onChange={(e) => handleRememberMeChange(e.target.checked)}
                      className="remember-me-checkbox"
                    />
                    <span className="remember-me-checkmark"></span>
                  </div>
                  <span className="remember-me-text">Remember me</span>
                </label>
              </div>
            </div>
          )}

          {error && <p className="error">{error}</p>}
          {success && (
            <p className="success">
              {successType === "registration" ? "Registration successful!" : "Login successful!"}
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

          {/* Google OAuth Login Button - Only show on Login */}
          {action === "Login" && (
            <div className="oauth-container">
              <div className="oauth-divider">
                <span className="oauth-divider-text">or</span>
              </div>
              <button
                type="button"
                className="google-oauth-button"
                onClick={handleGoogleLogin}
                disabled={googleOAuthLoading || loading}
              >
                {googleOAuthLoading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin className="oauth-button-icon" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="oauth-button-icon" viewBox="0 0 24 24" width="18" height="18">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </div>
          )}

          {loading && <div className="loading-spinner">Loading...</div>}
        </div>
      </div>
    </div>
  );
};

export default LoginRegister;

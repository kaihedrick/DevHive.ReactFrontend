import React from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import "../styles/login_register.css";
import DevHiveLogo from "./assets/DevHiveLogo.png"; // Import your logo
import email_icon from "./assets/email.png";
import password_icon from "./assets/password.png";
import user_icon from "./assets/person.png";
import useLoginRegister from "../hooks/useLoginRegister";
import InputField from "./InputField";
import SubmitButton from "./SubmitButton";

//this component will be used to render both the login and register pages dynamically by using our useLoginRegister hook
const LoginRegister = () => {
  const navigate = useNavigate(); 
  const {
    action,
    credentials,
    validationErrors,
    error,
    success,
    handleChange,
    handleButtonClick,
  } = useLoginRegister();

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
        {/*here are all the form inputs that will be used for registration & login*/}
        <div className="inputs">
          {action === "Sign Up" && (
            <>
              <InputField
                icon={user_icon}
                type="text"
                name="firstName"
                placeholder="First Name"
                value={credentials.firstName}
                onChange={handleChange}
                error={validationErrors.firstName}
              />
              <InputField
                icon={user_icon}
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={credentials.lastName}
                onChange={handleChange}
                error={validationErrors.lastName}
              />
              <InputField
                icon={email_icon}
                type="email"
                name="email"
                placeholder="Email"
                value={credentials.email}
                onChange={handleChange}
                error={validationErrors.email}
              />
            </>
          )}
          <InputField
            icon={user_icon}
            type="text"
            name="username"
            placeholder="Username"
            value={credentials.username}
            onChange={handleChange}
            error={validationErrors.username}
          />
          <InputField
            icon={password_icon}
            type="password"
            name="password"
            placeholder="Password"
            value={credentials.password}
            onChange={handleChange}
            error={validationErrors.password}
          />
          {action === "Sign Up" && (
            <InputField
              icon={password_icon}
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={credentials.confirmPassword}
              onChange={handleChange}
              error={validationErrors.confirmPassword}
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
          <SubmitButton
            label="Sign Up"
            isActive={action === "Sign Up"}
            onClick={() => handleButtonClick("Sign Up")}
          />
          <SubmitButton
            label="Login"
            isActive={action === "Login"}
            onClick={() => handleButtonClick("Login")}
          />
        </div>
      </div>
    </div>
  );
};

export default LoginRegister;

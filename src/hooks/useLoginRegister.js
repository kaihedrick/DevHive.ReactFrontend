import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, register, validateEmail } from "../services/authService";

const useLoginRegister = () => {
  const [action, setAction] = useState("Login"); // Tracks whether the user is logging in or signing up
  const [credentials, setCredentials] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  // Handle input changes and clear validation errors dynamically
  const handleChange = async (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setValidationErrors((prevErrors) => ({ ...prevErrors, [name]: false }));

    // If the email field is being edited, check for duplicates
    if (name === "email" && action === "Sign Up") {
      try {
        const isDuplicate = await validateEmail(value);
        if (isDuplicate) {
          setValidationErrors((prevErrors) => ({
            ...prevErrors,
            email: "Email is already in use. Please use a different email.",
          }));
        }
      } catch {
        console.error("Error checking email duplicate.");
      }
    }
  };

  // Validate form fields based on the current action
  const validateFields = () => {
    const errors = {};
    const specialCharacterRegex = /[!@#$%^&*(),.?":{}|<>]/; // Regex to check for special characters

    if (action === "Login") {
      if (!credentials.username) errors.username = "Username is required";
      if (!credentials.password) errors.password = "Password is required";
    } else if (action === "Sign Up") {
      if (!credentials.firstName) errors.firstName = "First Name is required";
      if (!credentials.lastName) errors.lastName = "Last Name is required";
      if (!credentials.email) {
        errors.email = "Email is required";
      } else if (!credentials.email.includes("@")) {
        errors.email = "Email must contain '@'";
      } else if (credentials.email.length < 8 || credentials.email.length > 100) {
        errors.email = "Email must be between 8 and 100 characters";
      }
      if (!credentials.username) errors.username = "Username is required";
      if (!credentials.password) {
        errors.password = "Password is required";
      } else if (credentials.password.length < 8 || credentials.password.length > 30) {
        errors.password = "Password must be between 8 and 30 characters";
      } else if (!specialCharacterRegex.test(credentials.password)) {
        errors.password = "Password must include at least one special character";
      }
      if (!credentials.confirmPassword) {
        errors.confirmPassword = "Confirm Password is required";
      } else if (credentials.password !== credentials.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Perform login or registration using the authService
  const handleAction = async () => {
    if (!validateFields()) return; // Stop if validation fails

    try {
      if (action === "Login") {
        const response = await login({
          username: credentials.username,
          password: credentials.password,
        });
        localStorage.setItem("authToken", response.token); // Save token to localStorage
        setSuccess(true);
        setError("");
        navigate("/projects"); // Redirect to projects page after successful login
      } else {
        await register(credentials);
        setSuccess(true);
        setError("");
        setAction("Login"); // Switch to login view after successful registration
        setCredentials({
          email: "",
          username: "",
          password: "",
          confirmPassword: "",
          firstName: "",
          lastName: "",
        }); // Clear form fields
      }
    } catch (err) {
      setError(err.response?.data || "An error occurred. Please try again.");
      setSuccess(false);
    }
  };

  // Handle switching between Login and Sign Up modes
  const handleButtonClick = (buttonAction) => {
    if (action !== buttonAction) {
      setAction(buttonAction);
      setSuccess(false);
      setError("");
      setValidationErrors({});
    } else {
      handleAction();
    }
  };

  return {
    action,
    credentials,
    validationErrors,
    error,
    success,
    handleChange,
    handleButtonClick,
  };
};

export default useLoginRegister;

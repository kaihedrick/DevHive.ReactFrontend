import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../services/authService.ts";
import { validateEmail } from "../services/userService";
/**
 * useLoginRegister
 *
 * Custom hook to handle login and registration logic.
 *
 * @returns {object} - The current state and handlers for login/register forms.
 *
 * @property {string} action - Current form mode: "Login" or "Sign Up".
 * @property {object} credentials - Form fields including email, username, password, etc.
 * @property {object} validationErrors - Object mapping field names to validation error messages.
 * @property {string} error - General error message.
 * @property {boolean} success - Flag indicating if the last operation was successful.
 * @property {boolean} loading - Flag indicating if an async operation is in progress.
 * @property {function} handleChange - Input field change handler with debounced email validation.
 * @property {function} handleButtonClick - Handles form submit or switching between login/register.
 * @property {string|null} emailValidationStatus - Validation result: "success", "error", or null.
 */
const useLoginRegister = () => {
  const [action, setAction] = useState("Login");
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
  const [successType, setSuccessType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emailValidationStatus, setEmailValidationStatus] = useState(null); // null, "success", "error"
  const [validatingEmail, setValidatingEmail] = useState(false); // Track email validation state
  
  const debounceTimeout = useRef(null); // Debounce timeout reference

  const navigate = useNavigate();

  // Memoized validation function
  const validateFields = useCallback(() => {
    const errors = {};
    const specialCharacterRegex = /[!@#$%^&*(),.?":{}|<>]/;

    if (action === "Login") {
      if (!credentials.username) errors.username = "Username is required";
      if (!credentials.password) errors.password = "Password is required";
    } else {
      if (!credentials.firstName) errors.firstName = "First Name is required";
      if (!credentials.lastName) errors.lastName = "Last Name is required";
      if (!credentials.email) {
        errors.email = "Email is required";
      } else if (!credentials.email.includes("@")) {
        errors.email = "Email must contain '@'";
      }
      if (!credentials.username) errors.username = "Username is required";
      if (!credentials.password) {
        errors.password = "Password is required";
      } else if (credentials.password.length < 8) {
        errors.password = "Password must be at least 8 characters";
      } else if (!specialCharacterRegex.test(credentials.password)) {
        errors.password = "Password must include at least one special character";
      }
      if (!credentials.confirmPassword) {
        errors.confirmPassword = "Confirm Password is required";
      } else if (credentials.password !== credentials.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    return errors;
  }, [action, credentials]);

  // Memoized email validation
  const validateEmailField = useCallback(async (email) => {
    if (!email || validatingEmail) {
      return; // Prevent validation if email is empty or already validating
    }

    const isValidEmailFormat = email.includes("@");
    console.log("isValidEmailFormat:", isValidEmailFormat);

    try {
      setValidatingEmail(true); // Set validating state to true
      const result = await validateEmail(email);
      console.log("validateEmail result:", result);

      if (result === false && isValidEmailFormat) {
        setEmailValidationStatus((prevState) => { // Use callback function
          console.log("Setting emailValidationStatus to success");
          return "success";
        });
        setValidationErrors(prev => ({ ...prev, email: "" }));
        console.log("emailValidationStatus set to success");
      } else {
        setEmailValidationStatus((prevState) => { // Use callback function
          console.log("Setting emailValidationStatus to error");
          return "error";
        });
        setValidationErrors(prev => ({ ...prev, email: "Email is already in use." }));
        console.log("emailValidationStatus set to error");
      }
    } catch (err) {
      console.error("❌ Error validating email:", err);
      setError("Error validating email. Please try again.");
      setEmailValidationStatus("error");
    } finally {
      setValidatingEmail(false); // Set validating state to false
    }
  }, [validateEmail, validatingEmail]);
  

  // Memoized input change handler with debounce
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    setValidationErrors(prev => ({ ...prev, [name]: "" }));

    if (name === "email" && action === "Sign Up" && value) {
      clearTimeout(debounceTimeout.current); // Clear previous timeout
      debounceTimeout.current = setTimeout(() => {
        validateEmailField(value);
      }, 600); // 600ms delay
    }
  }, [action, validateEmailField]);

  // Memoized action handler
  const handleAction = useCallback(async () => {
    const errors = validateFields();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);
    try {
      if (action === "Login") {
        const response = await login({
          username: credentials.username,
          password: credentials.password,
        });
          localStorage.setItem("token", response.token);
          localStorage.setItem("userId", response.userId);
          setSuccess(true);
          setSuccessType("login");
          setError("");
          navigate("/projects");
      } else {
        // Convert to backend-compatible format
        const registrationPayload = {
          username: credentials.username,
          email: credentials.email,
          password: credentials.password,
          firstName: credentials.firstName,
          lastName: credentials.lastName
        };
        
        await register(registrationPayload);
          setSuccess(true);
          setSuccessType("registration");
          setError("");
          setAction("Login");
          setCredentials({
            email: "",
            username: "",
            password: "",
            confirmPassword: "",
            firstName: "",
            lastName: "",
          });
      }
    } catch (err) {
        // Extract error message from normalized error or response data
        let errorMessage = "❌ An error occurred. Please try again.";
        if (err.message) {
          errorMessage = err.message; // Use normalized error message
        } else if (err.response?.data) {
          const data = err.response.data;
          errorMessage = data.detail || data.title || data.message || JSON.stringify(data);
        }
        setError(errorMessage);
        setSuccess(false);
        setSuccessType(null);
    } finally {
        setLoading(false);
    }
  }, [action, credentials, validateFields, navigate]);

  // Memoized button click handler
  const handleButtonClick = useCallback((buttonAction) => {
    if (action !== buttonAction) {
      setAction(buttonAction);
      setSuccess(false);
      setError("");
      setValidationErrors({});
    } else {
      handleAction();
    }
  }, [action, handleAction]);

  return {
    action,
    credentials,
    validationErrors,
    error,
    success,
    successType,
    loading,
    handleChange,
    handleButtonClick,
    emailValidationStatus, // Expose the new state variable
  };
};

export default useLoginRegister;

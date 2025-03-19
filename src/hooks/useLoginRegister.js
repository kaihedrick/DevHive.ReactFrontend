import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { login, register, validateEmail } from "../services/authService";

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
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [emailValidationStatus, setEmailValidationStatus] = useState(null); // null, "success", "error"
  
  const debounceTimeout = useRef(null); // Debounce timeout reference

  const navigate = useNavigate();

  // Cleanup effect
  useEffect(() => {
    return () => setMounted(false);
  }, []);

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
    if (!email) {
      setEmailValidationStatus(null); // Reset status
      return;
    }
  
    try {
      const result = await validateEmail(email);
  
      if (mounted) {
        if (result.isAvailable) {
          setEmailValidationStatus("success");
          setValidationErrors(prev => ({ ...prev, email: "" }));
        } else {
          setEmailValidationStatus("error");
          setValidationErrors(prev => ({ ...prev, email: result.message }));
        }
      }
    } catch (err) {
      if (mounted) {
        console.error("❌ Error validating email:", err);
        setError("Error validating email. Please try again.");
        setEmailValidationStatus("error");
      }
    }
  }, [mounted, validateEmail]);
  

  // Memoized input change handler with debounce
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    setValidationErrors(prev => ({ ...prev, [name]: "" }));
    setEmailValidationStatus(null); // Reset status on input change

    if (name === "email" && action === "Sign Up" && value) {
      clearTimeout(debounceTimeout.current);
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
        if (mounted) {
          localStorage.setItem("authToken", response.token);
          setSuccess(true);
          setError("");
          navigate("/projects");
        }
      } else {
        await register(credentials);
        if (mounted) {
          setSuccess(true);
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
      }
    } catch (err) {
      if (mounted) {
        setError(err.response?.data || "❌ An error occurred. Please try again.");
        setSuccess(false);
      }
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  }, [action, credentials, validateFields, navigate, mounted]);

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
    loading,
    handleChange,
    handleButtonClick,
    emailValidationStatus, // Expose the new state variable
  };
};

export default useLoginRegister;

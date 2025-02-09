import { useState } from "react";
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

  const navigate = useNavigate();

  // ✅ Handle input changes and check email duplicates
  const handleChange = async (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setValidationErrors((prevErrors) => ({ ...prevErrors, [name]: false }));

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
        console.error("❌ Error checking email duplicate.");
      }
    }
  };

  // ✅ Validate form fields
  const validateFields = () => {
    const errors = {};
    const specialCharacterRegex = /[!@#$%^&*(),.?":{}|<>]/;

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

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ✅ Handle login or registration
  const handleAction = async () => {
    if (!validateFields()) return;

    try {
      if (action === "Login") {
        const response = await login({
          username: credentials.username,
          password: credentials.password,
        });
        localStorage.setItem("authToken", response.token); // ✅ Store token
        setSuccess(true);
        setError("");
        navigate("/projects"); // ✅ Redirect to projects
      } else {
        await register(credentials);
        setSuccess(true);
        setError("");
        setAction("Login"); // ✅ Switch to login after registration
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
      setError(err.response?.data || "❌ An error occurred. Please try again.");
      setSuccess(false);
    }
  };

  // ✅ Handle switching between Login and Sign Up
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

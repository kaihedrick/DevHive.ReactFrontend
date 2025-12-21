import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext.tsx';
import { register } from '../services/authService';
import { useEmailValidation, isStrictEmailValid } from './useEmailValidation.ts';
import { isValidText, isValidUsername } from '../utils/validation.ts';
import { 
  LoginModel, 
  RegistrationFormModel,
  createEmptyRegistrationForm,
  convertToRegistrationPayload
} from '../models/user.ts';

type ActionType = 'Login' | 'Sign Up';

interface LoginRegisterState {
  action: ActionType;
  credentials: RegistrationFormModel; // Use RegistrationFormModel for form state
  validationErrors: Record<string, string>;
  error: string;
  success: boolean;
  successType: 'login' | 'registration' | null;
  loading: boolean;
  emailValidationStatus: 'success' | 'error' | 'validating' | null;
}
/**
 * useLoginRegisterNew
 *
 * Custom React hook for managing login and registration functionality.
 *
 * @returns {object} Form state and handlers for login/register pages.
 *
 * @property {string} action - Either "Login" or "Sign Up".
 * @property {RegistrationFormModel} credentials - Form fields for registration or login.
 * @property {Record<string, string>} validationErrors - Field-level validation errors.
 * @property {string} error - General error message.
 * @property {boolean} success - Whether the last operation was successful.
 * @property {boolean} loading - Indicates if a request is in progress.
 * @property {function} handleChange - Updates form values and triggers validation.
 * @property {function} handleButtonClick - Handles form mode switching or form submission.
 * @property {string | null} emailValidationStatus - Email validation result: "success", "error", or null.
 */
const useLoginRegisterNew = () => {
  const { login: loginFromContext } = useAuthContext();
  const [state, setState] = useState<LoginRegisterState>({
    action: 'Login',
    credentials: createEmptyRegistrationForm(),
    validationErrors: {},
    error: '',
    success: false,
    successType: null,
    loading: false,
    emailValidationStatus: null
  });
  
  const navigate = useNavigate();

  const updateState = (newState: Partial<LoginRegisterState>) => {
    setState(prev => ({ ...prev, ...newState }));
  };

  // Use the email validation hook for live validation
  const emailValidation = useEmailValidation(
    state.action === 'Sign Up' ? state.credentials.Email : '',
    500 // 500ms debounce
  );

  // Calculate email validation status based on hook result
  const getEmailValidationStatus = useCallback((): 'success' | 'error' | 'validating' | null => {
    if (!state.credentials.Email || state.action !== 'Sign Up') {
      return null;
    }

    if (emailValidation.isValidating) {
      return 'validating';
    }

    if (emailValidation.error) {
      return 'error';
    }

    if (emailValidation.isValid && emailValidation.available) {
      return 'success';
    }

    if (emailValidation.isValid && !emailValidation.available) {
      return 'error';
    }

    return null;
  }, [emailValidation, state.credentials.Email, state.action]);

  const emailValidationStatus = getEmailValidationStatus();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateState({
      credentials: { ...state.credentials, [name]: value } as RegistrationFormModel,
      validationErrors: { ...state.validationErrors, [name]: '' }
    });

    // Email validation is handled automatically by useEmailValidation hook
    // No need for manual debouncing or validation calls
  }, [state.credentials, state.validationErrors]);

  const validateFields = useCallback(() => {
    const errors: Record<string, string> = {};
    const specialCharacterRegex = /[!@#$%^&*(),.?":{}|<>]/;
    const { credentials, action } = state;

    if (action === 'Login') {
      if (!credentials.Username) errors.Username = 'Username is required';
      if (!credentials.Password) errors.Password = 'Password is required';
    } else {
      // First Name validation
      if (!credentials.FirstName) {
        errors.FirstName = 'First Name is required';
      } else if (credentials.FirstName.length > 20) {
        errors.FirstName = 'First Name cannot exceed 20 characters';
      } else if (!isValidText(credentials.FirstName)) {
        errors.FirstName = 'First Name contains invalid characters. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.';
      }
      
      // Last Name validation
      if (!credentials.LastName) {
        errors.LastName = 'Last Name is required';
      } else if (credentials.LastName.length > 20) {
        errors.LastName = 'Last Name cannot exceed 20 characters';
      } else if (!isValidText(credentials.LastName)) {
        errors.LastName = 'Last Name contains invalid characters. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.';
      }
      
      // Email validation
      if (!credentials.Email) {
        errors.Email = 'Email is required';
      } else {
        if (credentials.Email.length > 50) {
          errors.Email = 'Email cannot exceed 50 characters';
        } else if (!isStrictEmailValid(credentials.Email)) {
          // Strict email validation for final submission
          errors.Email = 'Please enter a valid email address (e.g., user@example.com)';
        } else if (!emailValidation.available && emailValidation.isValid) {
          // Email is taken (from live validation)
          errors.Email = 'Email is already in use';
        } else if (emailValidation.error) {
          // Email format is invalid (from live validation)
          errors.Email = emailValidation.error;
        }
      }
      
      // Username validation
      if (!credentials.Username) {
        errors.Username = 'Username is required';
      } else if (credentials.Username.length > 30) {
        errors.Username = 'Username cannot exceed 30 characters';
      } else if (!isValidUsername(credentials.Username)) {
        errors.Username = 'Username contains invalid characters. Only letters, numbers, spaces, and basic punctuation (! ? . , - _ ( )) are allowed.';
      }
      
      // Password validation
      if (!credentials.Password) {
        errors.Password = 'Password is required';
      } else if (credentials.Password.length < 8) {
        errors.Password = 'Password must be at least 8 characters';
      } else if (credentials.Password.length > 32) {
        errors.Password = 'Password cannot exceed 32 characters';
      } else if (!specialCharacterRegex.test(credentials.Password)) {
        errors.Password = 'Password must include at least one special character';
      }
      
      // Confirm Password validation
      if (!credentials.ConfirmPassword) {
        errors.ConfirmPassword = 'Confirm Password is required';
      } else if (credentials.Password !== credentials.ConfirmPassword) {
        errors.ConfirmPassword = 'Passwords do not match';
      }
    }

    return errors;
  }, [state.credentials, state.action, emailValidation]);

  const handleAction = useCallback(async () => {
    const errors = validateFields();
    if (Object.keys(errors).length > 0) {
      updateState({ validationErrors: errors });
      return;
    }

    updateState({ loading: true });
    try {
      if (state.action === 'Login') {
        // Convert to lowercase field names for backend API
        const loginCredentials = {
          username: state.credentials.Username,
          password: state.credentials.Password
        };
        
        // Use AuthContext login to update auth state
        await loginFromContext(loginCredentials as LoginModel);
        updateState({ success: true, successType: 'login', error: '' });
        
        // Check for redirect parameter
        const searchParams = new URLSearchParams(window.location.search);
        const redirectTo = searchParams.get('redirect');
        
        if (redirectTo) {
          navigate(redirectTo);
        } else {
          navigate('/projects');
        }
      } else {
        const registrationPayload = convertToRegistrationPayload(state.credentials);
        
        await register(registrationPayload as any);
        updateState({
          success: true,
          successType: 'registration',
          error: '',
          action: 'Login',
          credentials: createEmptyRegistrationForm()
        });
      }
    } catch (err: any) {
      // Extract error message from normalized error or response data
      let errorMessage = '❌ An error occurred. Please try again.';
      if (err?.message) {
        errorMessage = err.message; // Use normalized error message (includes backend detail)
      } else if (err?.response?.data) {
        const data = err.response.data;
        errorMessage = data.detail || data.title || data.message || JSON.stringify(data);
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      updateState({
        error: errorMessage,
        success: false,
        successType: null
      });
    } finally {
      updateState({ loading: false });
    }
  }, [state.action, state.credentials, validateFields, navigate]);

  const handleButtonClick = useCallback((buttonAction: ActionType) => {
    if (state.action !== buttonAction) {
      updateState({
        action: buttonAction,
        success: false,
        successType: null,
        error: '',
        validationErrors: {}
      });
    } else {
      handleAction();
    }
  }, [state.action, handleAction]);

  return {
    action: state.action,
    credentials: state.credentials,
    validationErrors: state.validationErrors,
    error: state.error,
    success: state.success,
    successType: state.successType,
    loading: state.loading,
    handleChange,
    handleButtonClick,
    emailValidationStatus,
    emailValidationError: emailValidation.error,
    emailValidationAvailable: emailValidation.available,
  };
};

export default useLoginRegisterNew;
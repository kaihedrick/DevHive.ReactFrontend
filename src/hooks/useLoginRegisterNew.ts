import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register, validateEmail } from '../services/authService';
import { 
  LoginModel, 
  RegistrationFormModel,
  createEmptyRegistrationForm,
  convertToUserModel
} from '../models/user.ts';

type ActionType = 'Login' | 'Sign Up';

interface LoginRegisterState {
  action: ActionType;
  credentials: RegistrationFormModel; // Use RegistrationFormModel for form state
  validationErrors: Record<string, string>;
  error: string;
  success: boolean;
  loading: boolean;
  emailValidationStatus: 'success' | 'error' | null;
  validatingEmail: boolean;
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
  const [state, setState] = useState<LoginRegisterState>({
    action: 'Login',
    credentials: createEmptyRegistrationForm(),
    validationErrors: {},
    error: '',
    success: false,
    loading: false,
    emailValidationStatus: null,
    validatingEmail: false
  });
  
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const updateState = (newState: Partial<LoginRegisterState>) => {
    setState(prev => ({ ...prev, ...newState }));
  };

  const validateEmailField = useCallback(async (email: string) => {
    if (!email || state.validatingEmail) {
      return;
    }

    const isValidEmailFormat = email.includes('@');
    
    try {
      updateState({ validatingEmail: true });
      const result = await validateEmail(email);
      console.log("Email validation result:", result);

      if (result === false && isValidEmailFormat) {
        console.log("Setting email validation status to success");
        updateState({ 
          emailValidationStatus: 'success',
          validationErrors: { ...state.validationErrors, Email: '' }
        });
      } else {
        console.log("Setting email validation status to error");
        updateState({
          emailValidationStatus: 'error',
          validationErrors: { ...state.validationErrors, Email: 'Email is already in use.' }
        });
      }
    } catch (err) {
      console.error('❌ Error validating email:', err);
      updateState({
        error: 'Error validating email. Please try again.',
        emailValidationStatus: 'error'
      });
    } finally {
      updateState({ validatingEmail: false });
    }
  }, [state.validatingEmail, state.validationErrors]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateState({
      credentials: { ...state.credentials, [name]: value } as RegistrationFormModel,
      validationErrors: { ...state.validationErrors, [name]: '' }
    });

    if (name === 'Email' && state.action === 'Sign Up' && value) {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        validateEmailField(value);
      }, 600);
    }
  }, [state.credentials, state.validationErrors, state.action, validateEmailField]);

  const validateFields = useCallback(() => {
    const errors: Record<string, string> = {};
    const specialCharacterRegex = /[!@#$%^&*(),.?":{}|<>]/;
    const { credentials, action } = state;

    if (action === 'Login') {
      if (!credentials.Username) errors.Username = 'Username is required';
      if (!credentials.Password) errors.Password = 'Password is required';
    } else {
      if (!credentials.FirstName) errors.FirstName = 'First Name is required';
      if (!credentials.LastName) errors.LastName = 'Last Name is required';
      if (!credentials.Email) {
        errors.Email = 'Email is required';
      } else if (!credentials.Email.includes('@')) {
        errors.Email = 'Email must contain "@"';
      }
      if (!credentials.Username) errors.Username = 'Username is required';
      if (!credentials.Password) {
        errors.Password = 'Password is required';
      } else if (credentials.Password.length < 8) {
        errors.Password = 'Password must be at least 8 characters';
      } else if (!specialCharacterRegex.test(credentials.Password)) {
        errors.Password = 'Password must include at least one special character';
      }
      if (!credentials.ConfirmPassword) {
        errors.ConfirmPassword = 'Confirm Password is required';
      } else if (credentials.Password !== credentials.ConfirmPassword) {
        errors.ConfirmPassword = 'Passwords do not match';
      }
    }

    return errors;
  }, [state.credentials, state.action]);

  const handleAction = useCallback(async () => {
    const errors = validateFields();
    if (Object.keys(errors).length > 0) {
      updateState({ validationErrors: errors });
      return;
    }

    updateState({ loading: true });
    try {
      if (state.action === 'Login') {
        const loginCredentials: LoginModel = {
          Username: state.credentials.Username,
          Password: state.credentials.Password
        };
        
        await login(loginCredentials);
        updateState({ success: true, error: '' });
        navigate('/projects');
      } else {
        const userModel = convertToUserModel(state.credentials);
        
        await register(userModel);
        updateState({
          success: true,
          error: '',
          action: 'Login',
          credentials: createEmptyRegistrationForm()
        });
      }
    } catch (err: any) {
      // Ensure error is always a string to prevent React crashes
      const errorMessage = typeof err?.message === 'string' 
        ? err.message 
        : '❌ An error occurred. Please try again.';
      
      updateState({
        error: errorMessage,
        success: false
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
    loading: state.loading,
    handleChange,
    handleButtonClick,
    emailValidationStatus: state.emailValidationStatus,
  };
};

export default useLoginRegisterNew;
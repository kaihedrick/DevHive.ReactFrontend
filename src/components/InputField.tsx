// src/components/InputField.tsx
import React, { forwardRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import '../styles/InputField.css';

interface InputFieldProps {
  icon: IconDefinition;
  type: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  emailValidationStatus?: 'success' | 'error' | null;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const InputField = forwardRef<HTMLInputElement, InputFieldProps>(({
  icon,
  type,
  name,
  placeholder,
  value,
  onChange,
  error,
  emailValidationStatus,
  onKeyDown
}, ref) => {
  return (
    <div className={`input-field ${error ? 'has-error' : ''}`}>
      {/* FontAwesome icon rendered inline like in ForgotPassword */}
      <FontAwesomeIcon icon={icon} className="input-icon" />
      
      <input
        ref={ref}
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />

      {/* Validation icons */}
      {emailValidationStatus === 'success' && (
        <FontAwesomeIcon icon={faCheckCircle} className="validation-icon success-icon" />
      )}
      {emailValidationStatus === 'error' && (
        <FontAwesomeIcon icon={faTimesCircle} className="validation-icon error-icon" />
      )}

      {/* Error Message */}
      {error && (
        <p id={`${name}-error`} className="error-message">{error}</p>
      )}
    </div>
  );
});

export default InputField;

// src/components/InputField.tsx
import React, { forwardRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import '../styles/inputs.css';

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
/**
 * InputField Component
 * 
 * Reusable input component for forms, supports:
 * - Icon display inside input box
 * - Error messaging with ARIA support
 * - Optional success/error validation icon (e.g. for email)
 * - Keyboard navigation via onKeyDown
 * - Forwarded ref support
 *
 * @param icon FontAwesome icon displayed at the start of the input
 * @param type Input type (e.g., text, password, email)
 * @param name Name of the input, used for form value identification
 * @param placeholder Placeholder text shown inside the input field
 * @param value Controlled value of the input
 * @param onChange Handler for value changes
 * @param error Optional string for validation error messaging
 * @param emailValidationStatus Optional field for displaying success or error icon
 * @param onKeyDown Optional keyboard handler (used for Enter key navigation)
 * 
 * @returns A styled input with icons and validation support
 */
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
    <div className={`input-field-container ${error ? 'has-error' : ''}`}>
      <div className="input-with-icon input-with-validation">
        <FontAwesomeIcon icon={icon} className="input-icon" />
        
        <input
          ref={ref}
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          className="input-field-base"
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />

        {/* Validation icons */}
        {emailValidationStatus === 'success' && (
          <FontAwesomeIcon icon={faCheckCircle} className="validation-icon success" />
        )}
        {emailValidationStatus === 'error' && (
          <FontAwesomeIcon icon={faTimesCircle} className="validation-icon error" />
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p id={`${name}-error`} className="input-error-message">{error}</p>
      )}
    </div>
  );
});

export default InputField;

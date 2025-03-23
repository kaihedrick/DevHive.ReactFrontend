// src/components/InputField.tsx
import React, { forwardRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import '../styles/InputField.css';

interface InputFieldProps {
  icon: string;
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
  // Debug
  console.log(`Field ${name} status:`, emailValidationStatus);
  
  return (
    <div className={`input-field ${error ? 'has-error' : ''}`}>
      <img src={icon} alt={`${name}-icon`} className="input-icon" />
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
      
      {/* Make the status icons more prominent and force display */}
      {emailValidationStatus === 'success' && (
        <FontAwesomeIcon 
          icon={faCheckCircle} 
          className="validation-icon success-icon" 
          style={{
            position: 'absolute',
            right: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'green',
            fontSize: '18px',
            zIndex: 5
          }}
        />
      )}
      
      {emailValidationStatus === 'error' && (
        <FontAwesomeIcon 
          icon={faTimesCircle} 
          className="validation-icon error-icon" 
          style={{
            position: 'absolute',
            right: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'red',
            fontSize: '18px',
            zIndex: 5
          }}
        />
      )}
      
      {error && <p id={`${name}-error`} className="error-message">{error}</p>}
    </div>
  );
});

export default InputField;

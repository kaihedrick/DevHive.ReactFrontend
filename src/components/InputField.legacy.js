import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
//outdated component, use InputField.tsx
const InputField = ({ icon, type, name, placeholder, value, onChange, error, emailValidationStatus }) => {
  return (
    <div className="input-container">
      <div className="input">
        <img src={icon} alt="icon" />
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        {name === "email" && emailValidationStatus === "success" && (
          <FontAwesomeIcon
            icon={faCheckCircle}
            className="success-icon"
          />
        )}
        {name === "email" && emailValidationStatus === "error" && (
          <FontAwesomeIcon
            icon={faTimesCircle}
            className="error-icon"
          />
        )}
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default InputField;

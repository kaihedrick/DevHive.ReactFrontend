// src/components/SubmitButton.tsx
import React from 'react';
import "../styles/SubmitButton.css";

interface SubmitButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}
/**
 * SubmitButton component used to trigger form submission or user actions
 *
 * @component
 * @param {string} label - The text displayed inside the button
 * @param {boolean} isActive - Determines if the button has the active styling
 * @param {() => void} onClick - Function called when the button is clicked
 * @param {boolean} [disabled=false] - Whether the button is disabled
 *
 * @returns {JSX.Element} A styled button element
 */
const SubmitButton: React.FC<SubmitButtonProps> = ({ 
  label, 
  isActive, 
  onClick, 
  disabled = false 
}) => {
  return (
    <button 
      className={`submit ${isActive ? 'active' : ''}`} 
      onClick={onClick} 
      disabled={disabled}
    >
      {label}
    </button>
  );
};

export default SubmitButton;
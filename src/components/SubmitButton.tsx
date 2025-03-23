// src/components/SubmitButton.tsx
import React from 'react';
import "../styles/SubmitButton.css";

interface SubmitButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

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
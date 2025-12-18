import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTrash, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import '../styles/confirmation_modal.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'delete' | 'warning' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmationModal Component
 * 
 * Apple-style confirmation modal with blurred background overlay.
 * Used to replace browser confirm() dialogs throughout the application.
 */
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  onConfirm,
  onCancel,
}) => {
  // Lock scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      
      return () => {
        document.documentElement.style.overflow = prevOverflow;
        document.body.classList.remove('modal-open');
      };
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const target = document.getElementById('modal-root') ?? document.body;

  const getIcon = () => {
    switch (type) {
      case 'delete':
        return faTrash;
      case 'danger':
        return faSignOutAlt;
      default:
        return faExclamationTriangle;
    }
  };

  const modalContent = (
    <div 
      className="confirmation-modal-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-message"
    >
      <div 
        className="confirmation-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirmation-modal-icon">
          <FontAwesomeIcon icon={getIcon()} />
        </div>
        
        <h3 id="confirmation-title" className="confirmation-modal-title">
          {title}
        </h3>
        
        <p id="confirmation-message" className="confirmation-modal-message">
          {message}
        </p>

        <div className="confirmation-modal-actions">
          <button
            type="button"
            className="confirmation-modal-btn confirmation-modal-btn--cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirmation-modal-btn confirmation-modal-btn--confirm confirmation-modal-btn--${type}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, target);
};

export default ConfirmationModal;


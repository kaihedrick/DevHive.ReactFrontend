import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faInfoCircle, faTimes } from '@fortawesome/free-solid-svg-icons';
import '../styles/toast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation immediately
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  useEffect(() => {
    const duration = toast.duration ?? 3000;
    const timer = setTimeout(() => {
      setIsRemoving(true);
      setTimeout(() => {
        onClose(toast.id);
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.duration, toast.id, onClose]);

  const handleClose = () => {
    setIsRemoving(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300); // Wait for animation to complete
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return faCheckCircle;
      case 'error':
        return faExclamationCircle;
      case 'warning':
        return faExclamationCircle;
      case 'info':
        return faInfoCircle;
      default:
        return faInfoCircle;
    }
  };

  const getTypeClass = () => {
    return `toast toast--${toast.type}`;
  };

  return (
    <div
      className={`${getTypeClass()} ${isVisible ? 'toast--visible' : ''} ${isRemoving ? 'toast--removing' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast__content">
        <FontAwesomeIcon icon={getIcon()} className="toast__icon" />
        <span className="toast__message">{toast.message}</span>
      </div>
      <button
        className="toast__close"
        onClick={handleClose}
        aria-label="Close notification"
        type="button"
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  console.log('🍞 ToastContainer render, toasts:', toasts.length); // Debug log
  
  if (toasts.length === 0) return null;

  const target = document.getElementById('toast-root') ?? document.body;
  console.log('🍞 Toast target:', target); // Debug log

  return createPortal(
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>,
    target
  );
};

export default ToastContainer;


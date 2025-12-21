import { useState, useEffect } from 'react';
import apiClient from '../lib/apiClient.ts';

export interface EmailValidationResult {
  available: boolean;
  isValid: boolean;
  error?: string;
}

/**
 * Strict email validation function (matches backend requirements)
 * Validates email format for final submission
 */
export function isStrictEmailValid(email: string): boolean {
  if (!email || email.length < 5 || email.length > 254) {
    return false;
  }

  const atCount = (email.match(/@/g) || []).length;
  if (atCount !== 1) {
    return false;
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [local, domain] = parts;
  if (!local || !domain) {
    return false;
  }

  // Domain must contain at least one dot
  if (!domain.includes('.')) {
    return false;
  }

  return true;
}

/**
 * useEmailValidation Hook
 * 
 * Provides live email validation as user types with debouncing.
 * Uses the backend /users/validate-email endpoint for real-time feedback.
 * 
 * @param email - Email address to validate
 * @param debounceMs - Debounce delay in milliseconds (default: 500ms)
 * @returns Email validation result with availability, validity, and error state
 */
export function useEmailValidation(email: string, debounceMs: number = 500) {
  const [result, setResult] = useState<EmailValidationResult>({
    available: false,
    isValid: false,
  });
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    // Clear result if email is empty
    if (!email || email.trim() === '') {
      setResult({ available: false, isValid: false });
      setIsValidating(false);
      return;
    }

    // Don't validate incomplete emails (too short or missing @)
    // This allows users to type without premature errors
    if (email.length < 3 || !email.includes('@')) {
      setResult({ available: false, isValid: false });
      setIsValidating(false);
      return;
    }

    // Debounce validation to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      setIsValidating(true);

      // Call validation endpoint (GET with query params)
      apiClient
        .get('/users/validate-email', {
          params: { email: email.trim() },
        })
        .then((response) => {
          const available = response.data?.available ?? false;
          setResult({
            available,
            isValid: true,
            error: available ? undefined : 'Email is already taken',
          });
        })
        .catch((error) => {
          if (error?.response?.status === 400) {
            // Invalid email format
            setResult({
              available: false,
              isValid: false,
              error: 'Invalid email format',
            });
          } else {
            // Network or other error
            setResult({
              available: false,
              isValid: false,
              error: 'Failed to validate email. Please try again.',
            });
          }
        })
        .finally(() => {
          setIsValidating(false);
        });
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [email, debounceMs]);

  return { ...result, isValidating };
}

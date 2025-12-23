import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/apiClient.ts';

export interface EmailValidationResult {
  available: boolean | null; // null = not validated yet, true = available, false = taken/invalid
  isValid: boolean | null; // null = not validated yet, true = valid format, false = invalid format
  isChecking: boolean;
  error: string | null;
}

/**
 * Lenient email validation for live typing (matches backend isValidEmailForLiveValidation)
 * Allows incomplete emails during typing, only rejects obviously invalid input
 * 
 * Rules:
 * - Allows empty strings (user is still typing)
 * - Rejects strings with whitespace
 * - Allows incomplete emails (e.g., "user@" or "user@example")
 * - Only rejects if:
 *   - Multiple @ symbols
 *   - @ symbol with empty local part
 *   - Domain contains whitespace
 */
export function hasBasicEmailFormat(email: string): boolean {
  if (email.length === 0) return true; // Allow empty during typing
  
  // Reject whitespace
  if (/\s/.test(email)) return false;
  
  // Reject multiple @ symbols
  const atCount = (email.match(/@/g) || []).length;
  if (atCount > 1) return false;
  
  // If @ is present, check local and domain parts
  if (email.includes('@')) {
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    
    const [local, domain] = parts;
    // Reject empty local part
    if (local.length === 0) return false;
    
    // Reject whitespace in domain
    if (/\s/.test(domain)) return false;
  }
  
  return true;
}

/**
 * Strict email validation function (matches backend isValidEmail)
 * Validates email format for final submission
 * 
 * Rules:
 * - Length: 5-254 characters
 * - Exactly one @ symbol
 * - Non-empty local part (before @)
 * - Non-empty domain part (after @)
 * - Domain must contain at least one . (e.g., example.com)
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
 * Implementation follows the Email Validation Guide:
 * - Client-side lenient validation (hasBasicFormat) before API calls
 * - Debounced API calls (default 400ms)
 * - React Query for caching and state management
 * - Proper error handling for network and format errors
 * 
 * @param email - Email address to validate
 * @param debounceMs - Debounce delay in milliseconds (default: 400ms)
 * @returns Email validation result with availability, validity, checking state, and error
 */
export function useEmailValidation(email: string, debounceMs: number = 400) {
  const [debouncedEmail, setDebouncedEmail] = useState(email);
  const [validationState, setValidationState] = useState<EmailValidationResult>({
    available: null,
    isValid: null,
    isChecking: false,
    error: null,
  });

  // Debounce the email input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmail(email);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [email, debounceMs]);

  // Query for email availability using React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['validate-email', debouncedEmail],
    queryFn: async () => {
      // Skip API call if email is empty
      if (!debouncedEmail || debouncedEmail.trim().length === 0) {
        return { available: null };
      }

      // Skip API call if format is obviously invalid (client-side check)
      if (!hasBasicEmailFormat(debouncedEmail)) {
        return { available: false, reason: 'invalid_format' };
      }

      // Call validation endpoint (GET with query params)
      const response = await api.get('/users/validate-email', {
        params: { email: debouncedEmail.trim().toLowerCase() },
      });

      return { available: response.data?.available ?? false };
    },
    enabled: debouncedEmail.length > 0 && hasBasicEmailFormat(debouncedEmail),
    staleTime: 30000, // Cache for 30 seconds
    retry: false, // Don't retry on validation errors
  });

  // Update validation state based on query results
  useEffect(() => {
    // Reset state if email is empty
    if (email.length === 0) {
      setValidationState({
        available: null,
        isValid: null,
        isChecking: false,
        error: null,
      });
      return;
    }

    // Check basic format first (client-side)
    if (!hasBasicEmailFormat(email)) {
      setValidationState({
        available: false,
        isValid: false,
        isChecking: false,
        error: 'Invalid email format',
      });
      return;
    }

    // Show checking state while query is loading
    if (isLoading) {
      setValidationState({
        available: null,
        isValid: null,
        isChecking: true,
        error: null,
      });
      return;
    }

    // Handle query error
    if (error) {
      const errorStatus = (error as any)?.response?.status;
      if (errorStatus === 400) {
        // Invalid email format from backend
        setValidationState({
          available: false,
          isValid: false,
          isChecking: false,
          error: 'Invalid email format',
        });
      } else {
        // Network or other error
        setValidationState({
          available: false,
          isValid: false,
          isChecking: false,
          error: 'Failed to validate email. Please try again.',
        });
      }
      return;
    }

    // Handle successful query result
    if (data) {
      if (data.reason === 'invalid_format') {
        setValidationState({
          available: false,
          isValid: false,
          isChecking: false,
          error: 'Invalid email format',
        });
      } else if (data.available === false) {
        setValidationState({
          available: false,
          isValid: true, // Format is valid, but email is taken
          isChecking: false,
          error: 'This email is already registered',
        });
      } else if (data.available === true) {
        setValidationState({
          available: true,
          isValid: true,
          isChecking: false,
          error: null,
        });
      } else {
        // available is null (empty email case)
        setValidationState({
          available: null,
          isValid: null,
          isChecking: false,
          error: null,
        });
      }
    }
  }, [email, debouncedEmail, data, isLoading, error]);

  // Return state in a format compatible with existing code
  return {
    available: validationState.available ?? false,
    isValid: validationState.isValid ?? false,
    isValidating: validationState.isChecking,
    error: validationState.error || undefined, // Convert null to undefined for compatibility
    // Also expose the full state for new code
    isChecking: validationState.isChecking,
  };
}





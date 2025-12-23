/**
 * Validation utility functions for form fields
 */

/**
 * Validates text contains only allowed characters
 * Allowed: alphanumeric, spaces, and basic punctuation: ! ? . , - _ ( )
 * 
 * @param text - Text to validate
 * @returns true if text contains only allowed characters, false otherwise
 */
export function isValidText(text: string): boolean {
  if (!text || text.trim() === '') return true; // Empty text is valid (handled by required validation)
  const allowedPattern = /^[a-zA-Z0-9\s!?.,\-_()]*$/;
  return allowedPattern.test(text);
}

/**
 * Validates username (same rules as text)
 * 
 * @param username - Username to validate
 * @returns true if username contains only allowed characters, false otherwise
 */
export function isValidUsername(username: string): boolean {
  return isValidText(username);
}

/**
 * Validates date is within reasonable range (not in past, not more than maxYears in future)
 * 
 * @param date - Date string to validate
 * @param maxYears - Maximum years in the future (default: 1)
 * @returns true if date is valid, false otherwise
 */
export function isValidDateRange(date: string, maxYears: number = 1): boolean {
  if (!date) return false;
  
  const dateObj = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
  
  const maxDate = new Date();
  maxDate.setFullYear(today.getFullYear() + maxYears);
  maxDate.setHours(23, 59, 59, 999); // End of day
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) return false;
  
  // Check if date is in the past
  if (dateObj < today) return false;
  
  // Check if date is too far in the future
  if (dateObj > maxDate) return false;
  
  return true;
}

/**
 * Validates that end date is after start date
 * 
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns true if end date is after start date, false otherwise
 */
export function isEndDateAfterStartDate(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  
  return end > start;
}





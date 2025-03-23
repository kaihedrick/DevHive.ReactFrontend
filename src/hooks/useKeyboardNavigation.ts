// src/hooks/useKeyboardNavigation.ts
import { useCallback } from 'react';

interface NavigationMap {
  [key: string]: string;
}

/**
 * Custom hook for keyboard navigation between form fields
 */
export const useKeyboardNavigation = (
  navigationMap: NavigationMap,
  submitAction: () => void
) => {
  const handleKeyNavigation = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    currentField: string
  ) => {
    console.log(`Key pressed: ${e.key} in field: ${currentField}`);
    
    if (e.key === 'Enter') {
      e.preventDefault();
      console.log(`Enter pressed in ${currentField}`);
      
      // Get the name of the next field from the navigation map
      const nextField = navigationMap[currentField];
      console.log(`Next field should be: ${nextField}`);
      
      if (nextField) {
        // If there's a next field, find it and focus it
        const nextElement = document.querySelector(`input[name="${nextField}"]`) as HTMLInputElement;
        if (nextElement) {
          console.log(`Found next element, focusing: ${nextField}`);
          // Try focus with a small delay to ensure the DOM is ready
          setTimeout(() => {
            nextElement.focus();
            console.log(`Focus called on ${nextField}`);
          }, 0);
        } else {
          console.log(`Could not find next element with name: ${nextField}`);
        }
      } else {
        // If no next field (empty string in map), submit the form
        console.log('No next field, submitting form');
        submitAction();
      }
    }
  }, [navigationMap, submitAction]);

  return handleKeyNavigation;
};
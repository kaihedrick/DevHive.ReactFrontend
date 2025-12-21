import { useEffect, useRef, RefObject } from 'react';

/**
 * Custom hook to automatically resize textarea height based on content
 * 
 * @param value - The current value of the textarea
 * @param minRows - Minimum number of rows (default: 1)
 * @returns Ref object to attach to the textarea element
 */
export function useAutoResizeTextarea(
  value: string,
  minRows: number = 1
): RefObject<HTMLTextAreaElement> {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate the minimum height based on rows
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const minHeight = lineHeight * minRows + 
      parseInt(getComputedStyle(textarea).paddingTop) + 
      parseInt(getComputedStyle(textarea).paddingBottom) +
      parseInt(getComputedStyle(textarea).borderTopWidth) +
      parseInt(getComputedStyle(textarea).borderBottomWidth);

    // Set height based on scrollHeight, but not less than minHeight
    const newHeight = Math.max(textarea.scrollHeight, minHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > newHeight ? 'auto' : 'hidden';
  }, [value, minRows]);

  return textareaRef;
}


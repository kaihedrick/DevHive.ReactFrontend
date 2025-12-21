import { useEffect, useRef } from 'react';

/**
 * Hook for Progressive Disclosure + Affordance scroll indicators
 * Adds visual fade gradients to indicate scrollable content above/below
 * 
 * @param dependencies - Array of dependencies that should trigger scroll recalculation
 * @returns ref to attach to the scrollable container
 */
export const useScrollIndicators = (dependencies: any[] = []) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollHeightRef = useRef<number>(0);
  const isTypingRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset scroll position and classes on mount/remount
    container.scrollTop = 0;
    container.classList.remove('no-scroll', 'scrolled-to-top', 'scrolled-to-bottom');
    lastScrollHeightRef.current = 0; // Reset tracked height
    isTypingRef.current = false;

    let timeoutId: NodeJS.Timeout;
    let resizeObserver: ResizeObserver | null = null;
    
    // Detect typing in input/textarea elements within the container
    // Use a more aggressive approach to prevent any recalculation during typing
    const handleInput = (e: Event) => {
      // Mark as typing immediately
      isTypingRef.current = true;
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Reset typing flag after user stops typing for 1500ms (longer cooldown)
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        // Trigger a scroll update after typing stops
        handleScroll(true);
      }, 1500); // Increased to 1500ms for more stability
    };
    
    // Attach input listeners to all input/textarea elements
    // Use capture phase to catch events early
    const inputs = container.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', handleInput, { passive: true, capture: true });
      input.addEventListener('keydown', handleInput, { passive: true, capture: true });
      input.addEventListener('keyup', handleInput, { passive: true, capture: true });
      input.addEventListener('focus', handleInput, { passive: true, capture: true });
    });
    
    // Also listen at container level for any input events that bubble up
    const handleContainerKeyDown = (e: KeyboardEvent) => {
      // Only mark as typing if it's an input-related key in an input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        handleInput(e);
      }
    };
    
    container.addEventListener('input', handleInput, { passive: true, capture: true });
    container.addEventListener('keydown', handleContainerKeyDown, { passive: true, capture: true });

    const handleScroll = (forceUpdate: boolean = false) => {
      // Skip ALL recalculation if user is actively typing
      if (isTypingRef.current) {
        return;
      }
      
      // Clear any pending timeouts
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Use requestAnimationFrame to ensure accurate measurements
      requestAnimationFrame(() => {
        // Double-check typing flag inside requestAnimationFrame
        if (isTypingRef.current) {
          return;
        }
        
        const { scrollTop, scrollHeight, clientHeight } = container;
        
        const isScrollable = scrollHeight > clientHeight + 5;
        const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 10;
        const isScrolledToTop = scrollTop < 10;

        // Remove all scroll-related classes first
        container.classList.remove('no-scroll', 'scrolled-to-top', 'scrolled-to-bottom');

        // Add/remove classes for CSS styling
        if (!isScrollable) {
          // Content fits on screen - hide both gradients
          container.classList.add('no-scroll');
        } else {
          // Content is scrollable
          // Bottom gradient visibility - show when NOT at bottom
          if (isScrolledToBottom) {
            container.classList.add('scrolled-to-bottom');
          }

          // Top gradient visibility - show when NOT at top
          if (isScrolledToTop) {
            container.classList.add('scrolled-to-top');
          }
        }
        
        // Update tracked height
        lastScrollHeightRef.current = scrollHeight;
      });
    };

    // Initial check with multiple delays to ensure layout is complete
    const initializeScrollDetection = () => {
      // Immediate check (force update on mount)
      handleScroll(true);

      // Check after short delay
      timeoutId = setTimeout(() => {
        handleScroll(true);
        // Check again after longer delay for any async content
        timeoutId = setTimeout(() => handleScroll(true), 300);
      }, 100);
    };

    // Wait for next frame to ensure container is rendered
    requestAnimationFrame(() => {
      initializeScrollDetection();
    });

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    // Disable ResizeObserver during typing to prevent flashing
    // ResizeObserver can trigger on layout shifts from typing
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        // ALWAYS skip if user is actively typing
        if (isTypingRef.current) {
          return;
        }
        
        const entry = entries[0];
        if (!entry) return;
        
        const target = entry.target as HTMLElement;
        
        // Only process if the container itself changed size
        if (target !== container) {
          return;
        }
        
        // Debounce and check typing flag again
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        timeoutId = setTimeout(() => {
          if (!isTypingRef.current) {
            handleScroll(false);
          }
        }, 300);
      });
      
      resizeObserver.observe(container, { box: 'border-box' });
    }

    // MutationObserver - watch for structural changes only
    const mutationObserver = new MutationObserver((mutations) => {
      // Skip if user is typing
      if (isTypingRef.current) {
        return;
      }
      
      // Only trigger if elements were actually added or removed (not just attribute changes)
      const hasStructuralChanges = mutations.some(mutation => 
        mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
      );
      
      if (hasStructuralChanges) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (!isTypingRef.current) {
            handleScroll(false);
          }
        }, 300);
      }
    });
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      container.removeEventListener('input', handleInput, true);
      container.removeEventListener('keydown', handleContainerKeyDown, true);
      
      // Remove input listeners
      const inputs = container.querySelectorAll('input, textarea');
      inputs.forEach(input => {
        input.removeEventListener('input', handleInput, true);
        input.removeEventListener('keydown', handleInput, true);
        input.removeEventListener('keyup', handleInput, true);
        input.removeEventListener('focus', handleInput, true);
      });
      
      if (resizeObserver) resizeObserver.disconnect();
      mutationObserver.disconnect();
      // Clean up classes on unmount
      container.classList.remove('no-scroll', 'scrolled-to-top', 'scrolled-to-bottom');
    };
  }, dependencies); // Re-run when dependencies change

  return containerRef;
};


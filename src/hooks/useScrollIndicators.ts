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
      
      // Reset typing flag after user stops typing for 1000ms (longer cooldown)
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
      }, 1000); // Increased from 500ms to 1000ms
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
      // Skip recalculation if user is actively typing
      if (!forceUpdate && isTypingRef.current) {
        return;
      }
      
      // Clear any pending timeouts
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Use requestAnimationFrame to ensure accurate measurements
      requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        
        // Only recalculate if scrollHeight changed significantly (more than 20px)
        // This prevents recalculation on tiny layout shifts from error messages
        const heightChange = Math.abs(scrollHeight - lastScrollHeightRef.current);
        if (!forceUpdate && heightChange < 20 && lastScrollHeightRef.current > 0) {
          // Height hasn't changed significantly, only update scroll position classes
          const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 10;
          const isScrolledToTop = scrollTop < 10;
          
          container.classList.remove('scrolled-to-top', 'scrolled-to-bottom');
          if (isScrolledToBottom) {
            container.classList.add('scrolled-to-bottom');
          }
          if (isScrolledToTop) {
            container.classList.add('scrolled-to-top');
          }
          return;
        }
        
        // Significant height change or forced update - full recalculation
        lastScrollHeightRef.current = scrollHeight;
        
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

    // Use ResizeObserver to detect when container size changes
    // CRITICAL: Only observe the container itself, NOT its children
    // This prevents firing when input elements resize during typing
    if (window.ResizeObserver) {
      let resizeDebounceTimeout: NodeJS.Timeout | null = null;
      
      resizeObserver = new ResizeObserver((entries) => {
        // ALWAYS skip if user is actively typing
        if (isTypingRef.current) {
          return;
        }
        
        // Check if the resize is from an input/textarea element
        const entry = entries[0];
        if (!entry) return;
        
        // Skip if the resized element is an input or textarea (or inside one)
        const target = entry.target as HTMLElement;
        // Check if target is an Element before calling closest()
        // entry.target might not be an Element in some edge cases
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        // Check if target is an Element and has closest method before calling it
        if (target.nodeType === Node.ELEMENT_NODE && typeof target.closest === 'function') {
          if (target.closest('input, textarea')) {
            return;
          }
        }
        
        // Only process if the container itself changed size
        if (target !== container) {
          return;
        }
        
        const newHeight = entry.contentRect.height;
        const heightChange = Math.abs(newHeight - lastScrollHeightRef.current);
        
        // Only trigger on significant height changes (>50px to be extra safe)
        if (heightChange > 50) {
          // Clear any pending resize debounce
          if (resizeDebounceTimeout) {
            clearTimeout(resizeDebounceTimeout);
          }
          
          // Debounce resize with longer delay
          resizeDebounceTimeout = setTimeout(() => {
            // Double-check typing flag before executing
            if (!isTypingRef.current) {
              handleScroll(false);
            }
            resizeDebounceTimeout = null;
          }, 500); // Longer debounce for resize
        }
      });
      
      // CRITICAL: Only observe the container, NOT its children
      resizeObserver.observe(container, { box: 'border-box' });
    }

    // Also check when content might have changed
    // Debounce mutation observer to avoid excessive recalculations
    // Only watch for structural changes (elements added/removed), not attribute changes
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
        timeoutId = setTimeout(() => handleScroll(false), 300); // Debounce DOM mutations
      }
    });
    mutationObserver.observe(container, {
      childList: true,      // Watch for added/removed elements
      subtree: true,        // Watch all descendants
      attributes: false,     // Don't watch attribute changes at all (they don't affect scroll height)
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


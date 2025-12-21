import React, { useEffect } from 'react';
import AppContent from './components/AppContent';

/**
 * App - Root application component
 * 
 * This component is now just a wrapper for AppContent.
 * All providers are in index.js (outside BrowserRouter) to ensure stability.
 */
function App() {
  // Debug logging - mount/unmount tracking
  useEffect(() => {
    console.log('🟢 App MOUNTED - should only happen ONCE on initial load');
    return () => {
      console.log('🔴 App UNMOUNTED - this should NEVER happen!');
    };
  }, []);

  return <AppContent />;
}

export default App;

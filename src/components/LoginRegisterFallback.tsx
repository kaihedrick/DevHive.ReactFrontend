import React from 'react';

// Fallback component for the old LoginRegister
// This will be removed after the new AuthPage is stable
const LoginRegisterFallback: React.FC = () => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #f5c542, #ff9f1c)',
      padding: '2rem'
    }}>
      <h1 style={{ color: 'white', marginBottom: '2rem' }}>
        Login/Register (Legacy)
      </h1>
      <p style={{ color: 'white', textAlign: 'center' }}>
        This is the legacy login/register component that will be removed.
        <br />
        The new AuthPage component is now active.
      </p>
    </div>
  );
};

export default LoginRegisterFallback;

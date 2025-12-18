import React from 'react';

const LoadingFallback: React.FC = () => {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingFallback;


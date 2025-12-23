import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { storeAuthData, getUserId } from '../services/authService.ts';
import { clearSelectedProject } from '../services/storageService';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
import { useAuthContext } from '../contexts/AuthContext.tsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import '../styles/login_register.css';

/**
 * GoogleOAuthCallback Component
 * 
 * Handles the OAuth callback from Google after user authorization.
 * Extracts token from URL fragment (hash) and stores it.
 * 
 * Note: Backend redirects to frontend with token in hash: #token={base64-encoded-json}
 * This component handles the token extraction and redirects to projects page.
 * 
 * @returns {JSX.Element} OAuth callback processing UI
 */
const GoogleOAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setOAuthMode, completeOAuthLogin } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Extract token from URL fragment (hash)
    // Backend redirects to frontend with token in hash: #token={base64-encoded-json}
    const hash = window.location.hash;
    
    const processOAuthCallback = async () => {
      if (hash.startsWith('#token=')) {
        try {
          // Task 2.2: Set OAuth mode before processing to block global refresh
          setOAuthMode(true);

          // Extract and decode token data from fragment
          const tokenDataEncoded = hash.substring(7); // Remove '#token='
          const tokenDataJSON = atob(tokenDataEncoded); // Decode base64
          const tokenData = JSON.parse(tokenDataJSON);

          // Check if switching users - if so, clear previous user's cached data
          const previousUserId = getUserId();

          if (previousUserId && previousUserId !== tokenData.userId) {
            // 1. Disconnect WebSocket to prevent stale connections
            cacheInvalidationService.disconnect('User changed during OAuth');

            // 2. Clear previous user's project selection
            clearSelectedProject(previousUserId);
          } else if (previousUserId === tokenData.userId) {
            // Even for same user, disconnect WebSocket to reconnect with fresh auth
            cacheInvalidationService.disconnect('Same user OAuth re-login');
          }

          // Clear React Query cache on OAuth login to prevent stale data
          queryClient.clear();
          localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');

          // Task 2.1: Store the access token and userId (no refresh call)
          // OAuth already provides a fresh, trusted token - no need to refresh
          storeAuthData(tokenData.token, tokenData.userId);

          // Task 2.1: Update AuthContext state directly without calling refresh
          completeOAuthLogin(tokenData.userId);

          // Task 2.2: Clear OAuth mode after completing login
          setOAuthMode(false);
          
          // Handle new user if needed
          if (tokenData.isNewUser) {
            // Show welcome/onboarding
            // You can add UI for new user onboarding here
          }
          
          // Clear the hash from URL for clean UX
          window.history.replaceState(null, '', window.location.pathname);
          
          // Invalidate projects query to ensure it refetches with new auth state
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          
          // Redirect to projects page
          setLoading(false);
          navigate('/projects');
        } catch (error) {
          // Task 2.2: Clear OAuth mode on error
          setOAuthMode(false);
          console.error('❌ Failed to parse OAuth token:', error);
          setError('Failed to complete Google login. Please try again.');
          setLoading(false);
          
          // Redirect to login on error
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        }
      } else {
        // No token in hash - redirect to login
        console.warn('⚠️ No OAuth token found in URL hash');
        setError('Invalid OAuth callback. Redirecting to login...');
        setLoading(false);
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    };

    processOAuthCallback();
  }, [navigate, queryClient, setOAuthMode, completeOAuthLogin]);

  return (
    <div className="login-register-page">
      <div className="background">
        <div className="logo-container">
          <h1 className="logo-text">DevHive</h1>
        </div>

        <div className="container">
          <div className="header">
            <div className="text">Completing Login</div>
            <div className="underline"></div>
          </div>

          {loading && (
            <div className="oauth-callback-loading">
              <FontAwesomeIcon icon={faSpinner} spin className="loading-icon" />
              <p>Completing Google sign-in...</p>
            </div>
          )}

          {error && (
            <div className="oauth-callback-error">
              <p className="error">{error}</p>
              <p className="error-hint">Redirecting to login page...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleOAuthCallback;


import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { storeAuthData, getUserId } from '../services/authService.ts';
import { clearSelectedProject } from '../services/storageService';
import { cacheInvalidationService } from '../services/cacheInvalidationService.ts';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Extract token from URL fragment (hash)
    // Backend redirects to frontend with token in hash: #token={base64-encoded-json}
    const hash = window.location.hash;
    
    const processOAuthCallback = async () => {
      if (hash.startsWith('#token=')) {
        try {
          // Extract and decode token data from fragment
          const tokenDataEncoded = hash.substring(7); // Remove '#token='
          const tokenDataJSON = atob(tokenDataEncoded); // Decode base64
          const tokenData = JSON.parse(tokenDataJSON);

          // Check if switching users - if so, clear previous user's cached data
          const previousUserId = getUserId();

          console.log('🔍 OAuth login user detection:', {
            previousUserId,
            newUserId: tokenData.userId,
            willClearCache: !!(previousUserId && previousUserId !== tokenData.userId)
          });

          if (previousUserId && previousUserId !== tokenData.userId) {
            console.log('🔄 User changed during OAuth login, clearing previous user data', {
              previousUserId,
              newUserId: tokenData.userId
            });

            // 1. Disconnect WebSocket to prevent stale connections
            cacheInvalidationService.disconnect('User changed during OAuth');

            // 2. Clear previous user's project selection
            clearSelectedProject(previousUserId);
          } else if (previousUserId === tokenData.userId) {
            console.log('ℹ️ Same user re-login, clearing cache to ensure fresh data');
            // Even for same user, disconnect WebSocket to reconnect with fresh auth
            cacheInvalidationService.disconnect('Same user OAuth re-login');
          } else {
            console.log('ℹ️ No previous user found, cache should be empty');
          }

          // ALWAYS clear React Query cache on OAuth login to prevent any stale data
          // This includes both in-memory cache AND persisted cache in localStorage
          console.log('🧹 Clearing React Query cache (in-memory and persisted) for OAuth login');
          queryClient.clear();

          // CRITICAL: Also clear the persisted React Query cache from localStorage
          // This is the root cause fix for the Google OAuth cache leak issue
          localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');

          // Store the access token (for API requests)
          storeAuthData(tokenData.token, tokenData.userId);

          console.log('✅ OAuth token stored from URL hash', {
            userId: tokenData.userId,
            isNewUser: tokenData.isNewUser,
            userChanged: previousUserId !== null && previousUserId !== tokenData.userId
          });
          
          // Handle new user if needed
          if (tokenData.isNewUser) {
            // Show welcome/onboarding
            console.log('New user:', tokenData.user);
            // You can add UI for new user onboarding here
            // e.g., show a welcome modal, redirect to profile completion, etc.
          }
          
          // Clear the hash from URL for clean UX
          window.history.replaceState(null, '', window.location.pathname);
          
          // Trigger auth state update
          window.dispatchEvent(new Event('auth-state-changed'));
          
          // Wait a brief moment for AuthContext to process the event and update state
          // This ensures isAuthenticated is true before Projects component mounts
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // Invalidate projects query to ensure it refetches with new auth state
          // This is critical because the query might have been disabled before auth was set
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          
          // Redirect to projects page
          setLoading(false);
          navigate('/projects');
        } catch (error) {
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
  }, [navigate, queryClient]);

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


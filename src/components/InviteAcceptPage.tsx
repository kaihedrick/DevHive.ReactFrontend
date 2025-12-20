import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInviteDetails, useAcceptInvite } from '../hooks/useInvites.ts';
import useAuth from '../hooks/useAuth.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { setSelectedProject } from '../services/storageService';
import '../styles/invite_accept.css';

/**
 * InviteAcceptPage Component
 * 
 * Displays invite details and handles invite acceptance.
 * Public route that works for both authenticated and unauthenticated users.
 */
const InviteAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useToast();

  const { data: inviteDetails, isLoading: loading, error: queryError } = useInviteDetails(
    token || null
  );

  const acceptInviteMutation = useAcceptInvite();

  const handleAcceptInvite = async () => {
    if (!token) {
      showError('Invalid invite link');
      return;
    }

    if (!isAuthenticated) {
      // Redirect to login with return URL
      navigate(`/?redirect=/invite/${token}`);
      return;
    }

    try {
      const project = await acceptInviteMutation.mutateAsync(token);
      
      // Debug: Log the project data returned from backend
      console.log('Project data from acceptInvite:', project);
      console.log('Project ID:', project?.id);
      console.log('Project has members?', !!project?.members);
      
      if (project?.id) {
        setSelectedProject(project.id);
        showSuccess(`Successfully joined project "${inviteDetails?.project?.name || project.name}"!`);
        
        // Delay to ensure cache updates propagate and backend processes membership
        // This ensures the project detail cache is set before ProjectDetails component mounts
        // and gives the backend time to fully process the membership
        await new Promise(resolve => setTimeout(resolve, 300));
        
        navigate('/project-details');
      } else {
        showSuccess('Successfully joined the project!');
        navigate('/projects');
      }
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to accept invite';
      showError(errorMsg);
    }
  };

  if (loading) {
    return (
      <div className="invite-accept-page">
        <div className="invite-accept-container">
          <div className="invite-accept-card">
            <div className="invite-accept-loading">Loading invite details...</div>
          </div>
        </div>
      </div>
    );
  }

  if (queryError || !inviteDetails) {
    return (
      <div className="invite-accept-page">
        <div className="invite-accept-container">
          <div className="invite-accept-card">
            <h1 className="invite-accept-title">Invite Not Found</h1>
            <p className="invite-accept-error-text">
              {queryError?.message || 'This invite link is invalid or has expired.'}
            </p>
            <button 
              className="primary-action-btn" 
              onClick={() => navigate('/')}
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Extract invite and project from nested structure
  const invite = inviteDetails?.invite;
  const projectInfo = inviteDetails?.project;
  const isExpired = invite ? new Date(invite.expiresAt) < new Date() : false;
  const isValid = invite?.isActive && !isExpired;

  return (
    <div className="invite-accept-page">
      <div className="invite-accept-container">
        <div className="invite-accept-card">
          <h1 className="invite-accept-title">Project Invitation</h1>
          
          <div className="invite-accept-details">
            <h2 className="invite-accept-subtitle">You've been invited to join:</h2>
            <h3 className="invite-accept-project-name">{projectInfo?.name || 'Unknown Project'}</h3>

            {isExpired && (
              <div className="invite-accept-status invite-accept-status--error">
                <p>This invite has expired.</p>
              </div>
            )}

            {!isValid && !isExpired && (
              <div className="invite-accept-status invite-accept-status--error">
                <p>This invite is no longer valid.</p>
              </div>
            )}

            {isValid && (
              <>
                <div className="invite-accept-meta">
                  <p>
                    <strong>Expires:</strong>{' '}
                    {invite ? new Date(invite.expiresAt).toLocaleString() : 'N/A'}
                  </p>
                </div>

                {!isAuthenticated && (
                  <div className="invite-accept-auth-prompt">
                    <p>You need to be logged in to accept this invite.</p>
                    <button 
                      className="primary-action-btn"
                      onClick={() => navigate(`/?redirect=/invite/${token}`)}
                    >
                      Login
                    </button>
                  </div>
                )}

                {isAuthenticated && (
                  <div className="invite-accept-actions">
                    <button
                      className="primary-action-btn"
                      onClick={handleAcceptInvite}
                      disabled={acceptInviteMutation.isPending}
                    >
                      {acceptInviteMutation.isPending ? 'Accepting...' : 'Accept Invite'}
                    </button>
                    <button
                      className="secondary-action-btn"
                      onClick={() => navigate('/projects')}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteAcceptPage;

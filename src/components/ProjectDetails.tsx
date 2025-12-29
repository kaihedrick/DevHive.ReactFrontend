import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faCrown, faRightFromBracket, faTimes, faCheck, faPlus, faCopy, faTrash, faSpinner, faLink } from "@fortawesome/free-solid-svg-icons";
import { useProject, useUpdateProject, useProjectMembers, useRemoveProjectMember, useDeleteProject, useLeaveProject } from "../hooks/useProjects.ts";
import { useProjectInvites, useCreateInvite, useRevokeInvite } from "../hooks/useInvites.ts";
import { useProjectWebSocket } from "../hooks/useProjectWebSocket.ts";
import { useScrollIndicators } from "../hooks/useScrollIndicators.ts";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea.ts";
import { getSelectedProject, setSelectedProject } from "../services/storageService";
import { Project, ProjectMember } from "../types/hooks.ts";
import ConfirmationModal from "./ConfirmationModal.tsx";
import { useToast } from "../contexts/ToastContext.tsx";
import "../styles/project_details.css";
import "../styles/create_sprint.css"; // Reuse Sprint form look & width clamp

/**
 * ProjectDetails Component
 * 
 * Displays detailed information about a specific project, including project name, description,
 * and members. Allows the project owner to edit project details, invite new members, and remove existing ones.
 */
const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const storedProjectId = getSelectedProject();
  const finalProjectId = projectId || storedProjectId;
  
  useEffect(() => {
    if (finalProjectId) {
      setSelectedProject(finalProjectId);
    }
    return () => {
      // Optional: Clear selected project on unmount
      // setSelectedProject(null);
    };
  }, [finalProjectId]);
  
  // Ensure WebSocket is connected for this project to receive cache invalidation messages
  useProjectWebSocket(finalProjectId);

  const { data: project, isLoading: projectLoading, error: projectError } = useProject(finalProjectId || '');
  
  // Handle 403 errors by redirecting (project already removed from cache by useProject hook)
  useEffect(() => {
    if (projectError && (projectError as any)?.status === 403) {
      navigate('/projects');
    }
  }, [projectError, navigate]);
  const updateProjectMutation = useUpdateProject();
  const { showSuccess, showError } = useToast();
  const { data: membersData, isLoading: membersLoading, error: membersError } = useProjectMembers(finalProjectId || '');
  const removeMemberMutation = useRemoveProjectMember();
  const deleteProjectMutation = useDeleteProject();
  const leaveProjectMutation = useLeaveProject();
  const { data: invitesData, isLoading: invitesLoading, error: invitesError } = useProjectInvites(finalProjectId || '', project || undefined);
  const createInviteMutation = useCreateInvite();
  const revokeInviteMutation = useRevokeInvite();
  
  // Get logged-in user ID
  const loggedInUserId = localStorage.getItem("userId");
  
  // Transform members data and calculate ownership
  const members = useMemo(() => {
    if (!membersData) return [];
    
    // Handle both {members: []} and [] response structures
    const membersArray = Array.isArray(membersData) ? membersData : (membersData.members || []);
    const projectOwnerId = project?.ownerId || (project as any)?.projectOwnerID || '';
    
    // Format member data with full names
    const formattedMembers = membersArray.map((member: any): ProjectMember => {
      // Backend should return full user objects, but handle both cases
      const firstName = member.firstName || member.FirstName || '';
      const lastName = member.lastName || member.LastName || '';
      const name = firstName && lastName ? `${firstName} ${lastName}` : (member.name || member.username || member.Username || 'Unknown');
      
      return {
        id: member.id,
        name,
        firstName: firstName,
        lastName: lastName,
        username: member.username || member.Username,
        isOwner: member.id === projectOwnerId,
      };
    });
    
    // Sort members to ensure the owner is always at the top
    return formattedMembers.sort((a, b) => {
      if (a.isOwner) return -1; // Owner comes first
      if (b.isOwner) return 1;
      return a.name.localeCompare(b.name); // Sort others alphabetically
    });
  }, [membersData, project]);
  
  // Stable ownership check using ref to persist during refetches
  // This prevents UI flicker when project data is temporarily unavailable during refetches
  const ownershipRef = useRef<boolean>(false);
  
  // Calculate if current user is owner
  // IMPORTANT: This must be stable during refetches to prevent UI flicker
  // Update ref when project is loaded, but don't clear it during refetches
  const isCurrentUserOwner = useMemo(() => {
    if (!finalProjectId || !loggedInUserId) {
      ownershipRef.current = false;
      return false;
    }
    
    // If project is loaded, check ownership from project data and update ref
    if (project) {
      const projectOwnerId = project.ownerId || (project as any)?.projectOwnerID || '';
      const userRole = project.userRole || (project as any)?.UserRole || '';
      // Check if user is owner by ID match or role
      const isOwner = loggedInUserId === projectOwnerId || userRole === 'owner';
      ownershipRef.current = isOwner;
      return isOwner;
    }
    
    // If project is not loaded yet (during refetch), use cached ownership from ref
    // This prevents UI from flickering when project data is temporarily unavailable
    return ownershipRef.current;
  }, [project, loggedInUserId, finalProjectId]);
  
  // Stable flag: we have a selected project (regardless of loading state)
  const hasSelectedProject = !!finalProjectId;

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedName, setEditedName] = useState<string>("");
  const [editedDescription, setEditedDescription] = useState<string>("");
  const [kickMemberId, setKickMemberId] = useState<string | null>(null);
  const [showKickModal, setShowKickModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false);
  
  // Invite management state
  const [showInvites, setShowInvites] = useState<boolean>(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number>(30);
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
  
  // Auto-resize textarea for description
  const descriptionTextareaRef = useAutoResizeTextarea(editedDescription, 4);
  
  // Progressive Disclosure + Affordance scroll indicators
  const containerRef = useScrollIndicators([members.length || 0, isEditing, showKickModal, showInvites]);
  const scrollShadowsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const shadows = scrollShadowsRef.current;

    if (!container || !shadows) {
      return;
    }

    const updateShadows = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrollable = scrollHeight > clientHeight + 1;
      const atTop = scrollTop <= 1;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

      shadows.classList.toggle('show-top', isScrollable && !atTop);
      shadows.classList.toggle('show-bottom', isScrollable && !atBottom);
    };

    const handleScroll = () => updateShadows();

    container.addEventListener('scroll', handleScroll, { passive: true });
    updateShadows();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateShadows())
      : null;

    if (resizeObserver) {
      resizeObserver.observe(container);
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [containerRef, members.length, isEditing, showInvites, showKickModal]);
  
  // Handle creating an invite
  const handleCreateInvite = async (): Promise<void> => {
    if (!finalProjectId) return;
    
    try {
      const invite = await createInviteMutation.mutateAsync({
        projectId: finalProjectId,
        data: {
          expiresInMinutes,
          maxUses: maxUses || undefined
        }
      });
      showSuccess("Invite link created successfully!");
      setExpiresInMinutes(30);
      setMaxUses(undefined);
    } catch (err: any) {
      // Handle 403 errors gracefully (user doesn't have permission)
      if (err?.status === 403 || err?.response?.status === 403) {
        showError("You don't have permission to create invites.");
      } else {
        const errorMsg = err.response?.data?.message || err.message || "Failed to create invite";
        showError(errorMsg);
      }
    }
  };
  
  // Handle revoking an invite
  const handleRevokeInvite = async (inviteId: string): Promise<void> => {
    if (!finalProjectId) return;
    
    try {
      await revokeInviteMutation.mutateAsync({
        projectId: finalProjectId,
        inviteId
      });
      showSuccess("Invite revoked successfully");
    } catch (err: any) {
      // Handle 403 errors gracefully (user doesn't have permission)
      if (err?.status === 403 || err?.response?.status === 403) {
        showError("You don't have permission to revoke invites.");
      } else {
        const errorMsg = err.response?.data?.message || err.message || "Failed to revoke invite";
        showError(errorMsg);
      }
    }
  };
  
  // Copy invite link to clipboard
  const handleCopyInviteLink = async (inviteUrl: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showSuccess("Invite link copied to clipboard!");
    } catch (err) {
      showError("Failed to copy invite link");
    }
  };
  
  // Format expiration time
  const formatExpiration = (expiresAt: string): string => {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) return "Expired";
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  };

  // Owner check (keep existing approach)
  const isOwner = useMemo(() => {
    return isCurrentUserOwner;
  }, [isCurrentUserOwner]);

  // Dirty state check
  const dirty = useMemo(() => {
    if (!project || !isEditing) return false;
    return editedName !== project.name || editedDescription !== (project.description || '');
  }, [project, isEditing, editedName, editedDescription]);
  
  const handleEditProject = (): void => {
    if (!project) return;
    setIsEditing(true);
    setEditedName(project.name);
    setEditedDescription(project.description);
  };
  
  const handleCancelEdit = (): void => {
    if (!project) return;
    setIsEditing(false);
    setEditedName(project.name);
    setEditedDescription(project.description);
  };
  
  const handleSaveEdit = async (): Promise<void> => {
    if (!project) return;

    try {
      await updateProjectMutation.mutateAsync({
        projectId: project.id,
        projectData: {
          name: editedName,
          description: editedDescription
        }
      });
      setIsEditing(false);
      // Cache is updated automatically by the mutation
    } catch (error: any) {
      console.error("Error updating project:", error);
    }
  };

  const handleKickMember = (memberId: string): void => {
    setKickMemberId(memberId);
    setShowKickModal(true);
  };

  const confirmKickMember = async (): Promise<void> => {
    if (!kickMemberId || !finalProjectId) return;

    try {
      await removeMemberMutation.mutateAsync({
        projectId: finalProjectId,
        userId: kickMemberId
      });
      showSuccess("Member removed successfully");
      setShowKickModal(false);
      setKickMemberId(null);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to remove member";
      showError(errorMsg);
      console.error("Error kicking member:", error);
    }
  };

  const cancelKickMember = (): void => {
    setShowKickModal(false);
    setKickMemberId(null);
  };

  // Delete project handler (owner only)
  const handleDeleteProject = (): void => {
    if (!project || !isOwner) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!project) return;
    setShowDeleteConfirm(false);
    try {
      await deleteProjectMutation.mutateAsync(project.id);
      navigate('/projects');
    } catch (error: any) {
      console.error("Error deleting project:", error);
      showError(error.response?.data?.message || error.message || "Failed to delete project. Please try again.");
    }
  };

  const handleDeleteCancel = (): void => {
    setShowDeleteConfirm(false);
  };

  // Leave project handler (member only)
  const handleLeaveProject = (): void => {
    if (!project || isOwner) return;
    setShowLeaveConfirm(true);
  };

  const handleLeaveConfirm = async (): Promise<void> => {
    if (!project) return;
    setShowLeaveConfirm(false);
    try {
      await leaveProjectMutation.mutateAsync(project.id);
      navigate('/projects');
    } catch (error: any) {
      console.error("Error leaving project:", error);
      showError(error.response?.data?.message || error.message || "Failed to leave project. Please try again.");
    }
  };

  const handleLeaveCancel = (): void => {
    setShowLeaveConfirm(false);
  };

  if (projectLoading || membersLoading) {
    return (
      <div className="project-details">
        <div className="loading-message">
          <p>Loading project details...</p>
        </div>
      </div>
    );
  }

  // Helper function to extract error message from various error object structures
  const getErrorMessage = (error: any): string => {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    
    // Check responseData first (TanStack Query normalized errors)
    if (error?.responseData) {
      const data = error.responseData;
      if (data?.detail) return data.detail;
      if (data?.title) return data.title;
      if (data?.message) return data.message;
      if (typeof data === 'string') return data;
    }
    
    // Check response.data (Axios errors)
    if (error?.response?.data) {
      const data = error.response.data;
      if (data?.detail) return data.detail;
      if (data?.title) return data.title;
      if (data?.message) return data.message;
      if (typeof data === 'string') return data;
    }
    
    // Check top-level message
    if (error?.message) return error.message;
    
    // Check originalError (nested error)
    if (error?.originalError) {
      const originalMsg = getErrorMessage(error.originalError);
      if (originalMsg !== 'Unknown error' && originalMsg !== 'An error occurred') {
        return originalMsg;
      }
    }
    
    // For 403 errors, provide a user-friendly message
    if (error?.status === 403 || error?.response?.status === 403) {
      return 'Access denied. You may have been removed from this project.';
    }
    
    // Last resort: return generic message
    return 'An error occurred';
  };

  if (projectError || membersError) {
    const errorMessage = getErrorMessage(projectError || membersError);
    const isForbidden = (projectError as any)?.status === 403 || (membersError as any)?.status === 403;
    
    return (
      <div className="project-details">
        <div className="error-message">
          <p>{isForbidden ? 'Access Denied' : 'Error'}: {errorMessage}</p>
          <button onClick={() => navigate('/projects')} className="primary-action-btn">
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-details">
        <div className="no-project-message">
          <h2>Project Not Found</h2>
          <p>The requested project could not be found.</p>
          <button onClick={() => navigate('/projects')} className="primary-action-btn">
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-details-page page--fullscreen">
      <div className="project-details-surface">
        <div
          ref={scrollShadowsRef}
          className="scroll-shadows"
          aria-hidden="true"
        ></div>
        <div ref={containerRef} className="create-sprint-container with-footer-pad">{/* iPhone-first width clamp */}
      {/* Keep existing header */}
      <div className="create-sprint-nav-bar">
        <button className="back-nav-btn" onClick={() => navigate(-1)}>Back</button>
        <h1 className="create-sprint-title">Project Details</h1>
        <div className="nav-spacer" />
      </div>

      {/* Keep existing form fields */}
      <form className="create-sprint-form" onSubmit={(e) => e.preventDefault()}>
        {/* Project Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="project-name">Project name</label>
          {isEditing ? (
            <input
              id="project-name"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="form-input"
              placeholder="Project name"
              maxLength={255}
            />
          ) : (
            <input
              id="project-name"
              type="text"
              value={project.name}
              readOnly
              className="form-input"
            />
          )}
          {isEditing && (
            <div className="char-count">{editedName.length}/255</div>
          )}
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label" htmlFor="project-desc">Description</label>
          {isEditing ? (
            <textarea
              ref={descriptionTextareaRef}
              id="project-desc"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="form-input"
              rows={4}
              placeholder="Project description"
              maxLength={255}
              style={{ resize: 'none', overflow: 'hidden' }}
            />
          ) : (
            <textarea
              id="project-desc"
              value={project.description || ''}
              readOnly
              className="form-input"
              rows={4}
            />
          )}
          {isEditing && (
            <div className="char-count">{editedDescription.length}/255</div>
          )}
        </div>

        {/* Primary action stays inline */}
        {isEditing && (
          <div className="form-actions">
            <button type="button" className="primary-action-btn" onClick={handleSaveEdit}>
              Save Changes
            </button>
            <button type="button" className="secondary-action-btn" onClick={handleCancelEdit}>
              Cancel
            </button>
          </div>
        )}

        {/* Edit button when not editing */}
        {!isEditing && isCurrentUserOwner && (
          <div className="form-actions">
            <button type="button" className="secondary-action-btn" onClick={handleEditProject}>
              <FontAwesomeIcon icon={faPenToSquare} style={{ marginRight: '8px' }} />
              Edit Project
            </button>
          </div>
        )}

        {/* Members Section */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Project Members</label>
            {/* Gate on hasSelectedProject to prevent hiding during refetches */}
            {/* Show invite button based on permissions - use permissions if available, otherwise show (backend handles permission check) */}
            {hasSelectedProject && (project?.permissions?.canViewInvites !== false) && (
              <button
                type="button"
                onClick={() => setShowInvites(!showInvites)}
                className="add-member-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-medium)',
                  cursor: 'pointer',
                  padding: 'var(--space-1) var(--space-2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  transition: 'opacity 0.2s ease',
                  borderRadius: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.background = 'hsla(var(--gold-hue), var(--gold-saturation), 60%, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.background = 'none';
                }}
              >
                <FontAwesomeIcon icon={faLink} style={{ fontSize: '14px' }} />
                <span>Invites</span>
              </button>
            )}
          </div>
          
          {/* Invite Management Section */}
          {/* Gate on hasSelectedProject to prevent hiding during refetches */}
          {/* Show invite section based on permissions - use permissions if available, otherwise show (backend handles permission check) */}
          {hasSelectedProject && showInvites && (project?.permissions?.canViewInvites !== false) && (
            <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-4)' }}>Invite Management</h3>
              
              {/* Show error message if user doesn't have permission (403 error) */}
              {invitesError && (invitesError as any)?.status === 403 && (
                <div style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)', background: 'var(--bg-warning)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                  You don't have permission to view invites.
                </div>
              )}
              
              {/* Create Invite Section - Only show if user can create invites */}
              {/* Gate on hasSelectedProject to prevent hiding during refetches */}
              {/* Show create invite form based on permissions - only fall back to owner check if permissions aren't loaded yet */}
              {hasSelectedProject && (project?.permissions?.canCreateInvites ?? (project ? undefined : isCurrentUserOwner)) && (
                <>
                  <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-3)' }}>Create Invite Link</h4>
                  
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Expires In (minutes)</label>
                <input
                  type="number"
                  value={expiresInMinutes}
                  onChange={(e) => setExpiresInMinutes(parseInt(e.target.value) || 30)}
                  min="1"
                  className="form-input"
                  placeholder="30"
                />
              </div>
              
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Max Uses (optional)</label>
                <input
                  type="number"
                  value={maxUses || ''}
                  onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : undefined)}
                  min="1"
                  className="form-input"
                  placeholder="Unlimited"
                />
              </div>
              
              <div className="form-actions" style={{ marginTop: 'var(--space-3)' }}>
                <button
                  type="button"
                  onClick={handleCreateInvite}
                  className="primary-action-btn"
                  disabled={createInviteMutation.isPending}
                >
                  {createInviteMutation.isPending ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faPlus} style={{ marginRight: '8px' }} />
                      Create Invite Link
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInvites(false);
                    setExpiresInMinutes(30);
                    setMaxUses(undefined);
                  }}
                  className="secondary-action-btn"
                >
                  Cancel
                </button>
              </div>
                </>
              )}
              
              {/* Active Invites List - Only show if user can view invites */}
              {/* Gate on hasSelectedProject to prevent hiding during refetches */}
              {/* Show invites list based on permissions - use permissions if available, otherwise show (backend handles permission check) */}
              {hasSelectedProject && (project?.permissions?.canViewInvites !== false) && (
                <>
                  {invitesLoading && (
                    <div style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Loading invites...
                    </div>
                  )}
                  {!invitesLoading && invitesData && invitesData.invites && invitesData.invites.length > 0 && (
                    <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-3)' }}>Active Invites</h4>
                      {invitesData.invites.filter((invite: any) => invite.isActive && new Date(invite.expiresAt) > new Date()).map((invite: any) => (
                    <div
                      key={invite.id}
                      style={{
                        padding: 'var(--space-3)',
                        marginBottom: 'var(--space-2)',
                        background: 'var(--bg-primary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-3)'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', wordBreak: 'break-all' }}>
                          {invite.inviteUrl || (invite.token ? `${window.location.origin}/invite/${invite.token}` : 'N/A')}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                          Expires in {formatExpiration(invite.expiresAt)}
                          {invite.maxUses && ` • ${invite.usedCount || invite.useCount || 0}/${invite.maxUses} uses`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyInviteLink(invite.inviteUrl || (invite.token ? `${window.location.origin}/invite/${invite.token}` : ''))}
                          className="secondary-action-btn"
                          style={{ padding: 'var(--space-2)', minWidth: 'auto' }}
                          title="Copy link"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                        {project?.permissions?.canRevokeInvites && (
                          <button
                            type="button"
                            onClick={() => handleRevokeInvite(invite.id)}
                            className="danger-action-btn"
                            style={{ padding: 'var(--space-2)', minWidth: 'auto' }}
                            disabled={revokeInviteMutation.isPending}
                            title="Revoke invite"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                    </div>
                  )}
                  {!invitesLoading && invitesData && invitesData.invites && invitesData.invites.length === 0 && (
                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No active invites. Create one above to get started.
                    </div>
                  )}
                  {!invitesLoading && invitesData && invitesData.invites && invitesData.invites.length > 0 && invitesData.invites.filter((invite: any) => invite.isActive && new Date(invite.expiresAt) > new Date()).length === 0 && (
                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No active invites (all invites are expired or inactive).
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {membersLoading ? (
            <div className="loading-message">
              <p>Loading members...</p>
            </div>
          ) : membersError ? (
            <div className="error-message">
              <p>Error loading members: {getErrorMessage(membersError)}</p>
            </div>
          ) : (
            <div className="members-list">
              {members.map((member: ProjectMember) => (
                <div key={member.id} className="member-item">
                  <div className="member-info">
                    <span className="member-name">{member.name || member.username || `${member.firstName} ${member.lastName}`}</span>
                    {member.isOwner && (
                      <span className="crown">
                        <FontAwesomeIcon icon={faCrown} />
                        Owner
                      </span>
                    )}
                    {!member.isOwner && (member as any).role && (
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginLeft: 'var(--space-2)' }}>
                        ({(member as any).role})
                      </span>
                    )}
                  </div>
                  {isCurrentUserOwner && !member.isOwner && (
                    <button
                      type="button"
                      onClick={() => handleKickMember(member.id)}
                      className="kick-member-btn"
                      title="Remove member"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: 'var(--space-2)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        fontSize: 'var(--font-size-base)',
                        minWidth: '32px',
                        minHeight: '32px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'hsla(0, 70%, 50%, 0.1)';
                        e.currentTarget.style.color = 'hsl(0, 70%, 50%)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'none';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <FontAwesomeIcon icon={faRightFromBracket} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Inline danger actions (desktop). We'll hide these on mobile if using the FAB sheet. */}
        <div className="form-actions project-inline-secondary-actions">
          {isOwner ? (
            <button type="button" className="danger-action-btn" onClick={handleDeleteProject}>
              Delete Project
            </button>
          ) : (
            <button type="button" className="danger-action-btn" onClick={handleLeaveProject}>
              Leave Project
            </button>
          )}
        </div>
      </form>

      {/* Kick Member Confirmation Modal */}
      {showKickModal && (
        <div className="modal-overlay active">
          <div className="modal">
            <h3>Confirm Removal</h3>
            <p>Are you sure you want to remove this member from the project?</p>
            <div className="modal-actions">
              <button onClick={confirmKickMember} className="primary-action-btn">
                <FontAwesomeIcon icon={faRightFromBracket} />
                Remove
              </button>
              <button onClick={cancelKickMember} className="secondary-action-btn">
                <FontAwesomeIcon icon={faTimes} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {project && (
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          title="Delete Project"
          message={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          type="delete"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      {/* Leave Project Confirmation Modal */}
      {project && (
        <ConfirmationModal
          isOpen={showLeaveConfirm}
          title="Leave Project"
          message={`Are you sure you want to leave "${project.name}"? You will need to be invited again to rejoin.`}
          confirmText="Leave"
          cancelText="Cancel"
          type="danger"
          onConfirm={handleLeaveConfirm}
          onCancel={handleLeaveCancel}
        />
      )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;

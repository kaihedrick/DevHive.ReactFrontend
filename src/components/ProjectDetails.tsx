import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faCrown, faRightFromBracket, faTimes, faCheck } from "@fortawesome/free-solid-svg-icons";
import { useProject } from "../hooks/useProject.ts";
import { useProjectMembers } from "../hooks/useProjectMembers.ts";
import { useScrollIndicators } from "../hooks/useScrollIndicators.ts";
import { getSelectedProject, setSelectedProject } from "../services/storageService";
import { updateProject, removeProjectMember, deleteProject, leaveProject } from "../services/projectService";
import { Project, ProjectMember } from "../types/hooks.ts";
import ConfirmationModal from "./ConfirmationModal.tsx";
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
  
  const { project, loading: projectLoading, error: projectError, refreshProject } = useProject(finalProjectId || '');
  const { members, loading: membersLoading, error: membersError, isCurrentUserOwner, kickMember } = useProjectMembers(
    finalProjectId || '',
    project?.ownerId || (project as any)?.projectOwnerID
  );

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedName, setEditedName] = useState<string>("");
  const [editedDescription, setEditedDescription] = useState<string>("");
  const [kickMemberId, setKickMemberId] = useState<string | null>(null);
  const [showKickModal, setShowKickModal] = useState<boolean>(false);
  const [showActions, setShowActions] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false);

  const loggedInUserId = localStorage.getItem("userId");
  
  // Progressive Disclosure + Affordance scroll indicators
  const containerRef = useScrollIndicators([members.length, isEditing, showKickModal]);

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
      await updateProject(project.id, {
        name: editedName,
        description: editedDescription
      });
      setIsEditing(false);
      await refreshProject();
    } catch (error: any) {
      console.error("Error updating project:", error);
    }
  };

  const handleKickMember = (memberId: string): void => {
    setKickMemberId(memberId);
    setShowKickModal(true);
  };

  const confirmKickMember = async (): Promise<void> => {
    if (!kickMemberId) return;

    try {
      await kickMember(kickMemberId);
      setShowKickModal(false);
      setKickMemberId(null);
    } catch (error: any) {
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
      await deleteProject(project.id);
      navigate('/projects');
    } catch (error: any) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project. Please try again.");
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
      await leaveProject(project.id);
      navigate('/projects');
    } catch (error: any) {
      console.error("Error leaving project:", error);
      alert("Failed to leave project. Please try again.");
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

  if (projectError || membersError) {
    return (
      <div className="project-details">
        <div className="error-message">
          <p>Error: {projectError || membersError}</p>
          <button onClick={() => navigate('/projects')} className="btn-primary">
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
          <button onClick={() => navigate('/projects')} className="btn-primary">
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-details-page">
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
              id="project-desc"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="form-input"
              rows={4}
              placeholder="Project description"
              maxLength={255}
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
          <label className="form-label">Project Members</label>
          {membersLoading ? (
            <div className="loading-message">
              <p>Loading members...</p>
            </div>
          ) : membersError ? (
            <div className="error-message">
              <p>Error loading members: {membersError}</p>
            </div>
          ) : (
            <div className="members-list">
              {members.map((member: ProjectMember) => (
                <div key={member.id} className="member-item">
                  <div className="member-info">
                    <span className="member-name">{member.name}</span>
                    {member.isOwner && (
                      <span className="crown">
                        <FontAwesomeIcon icon={faCrown} />
                        Owner
                      </span>
                    )}
                  </div>
                  {isCurrentUserOwner && !member.isOwner && (
                    <button
                      type="button"
                      onClick={() => handleKickMember(member.id)}
                      className="kick-member"
                    >
                      <FontAwesomeIcon icon={faRightFromBracket} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite Members Button */}
        <div className="form-actions">
          <button type="button" className="secondary-action-btn" onClick={() => navigate('/invite')}>
            Invite Members
          </button>
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

      {/* Mobile-only Floating Action Button (⋯ for more actions) */}
      <button
        type="button"
        className="fab"
        aria-label="Project actions"
        aria-haspopup="dialog"
        aria-expanded={showActions}
        onClick={() => setShowActions(true)}
      >
        <span className="fab__icon">⋯</span>
      </button>

      {/* Bottom action sheet (secondary actions) */}
      {showActions && (
        <div className="action-sheet" role="dialog" aria-modal="true" aria-label="Project actions">
          <div className="action-sheet__scrim" onClick={() => setShowActions(false)} />
          <div className="action-sheet__panel">
            <div className="sheet-handle" aria-hidden />
            <div className="sheet-group">
              {isOwner ? (
                <button type="button" className="danger-action-btn" onClick={() => { setShowActions(false); handleDeleteProject(); }}>
                  Delete Project
                </button>
              ) : (
                <button type="button" className="danger-action-btn" onClick={() => { setShowActions(false); handleLeaveProject(); }}>
                  Leave Project
                </button>
              )}
            </div>
            <button type="button" className="secondary-action-btn" onClick={() => setShowActions(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Kick Member Confirmation Modal */}
      {showKickModal && (
        <div className="modal-overlay active">
          <div className="modal">
            <h3>Confirm Removal</h3>
            <p>Are you sure you want to remove this member from the project?</p>
            <div className="modal-actions">
              <button onClick={confirmKickMember} className="confirm-btn">
                <FontAwesomeIcon icon={faRightFromBracket} />
              </button>
              <button onClick={cancelKickMember} className="cancel-btn">
                <FontAwesomeIcon icon={faTimes} />
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
  );
};

export default ProjectDetails;

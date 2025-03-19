import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faCrown, faRightFromBracket, faXmark, faCheck } from "@fortawesome/free-solid-svg-icons";
import { useProject } from "../hooks/useProject";
import { useProjectMembers } from "../hooks/useProjectMembers"; // Change to named import
import { getSelectedProject, setSelectedProject } from '../services/storageService';
import { editProject } from "../services/projectService";
import "../styles/project_details.css";

const ProjectDetails = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const storedProjectId = getSelectedProject();
  const finalProjectId = projectId || storedProjectId;

  // Add cleanup on unmount
  useEffect(() => {
    if (finalProjectId) {
      setSelectedProject(finalProjectId);
    }
    return () => {
      // Optional: Clear selected project on unmount
      // setSelectedProject(null);
    };
  }, [finalProjectId]);

  // Replace useProjectDetails with individual hooks
  const { project, loading: projectLoading, error: projectError, refreshProject } = useProject(finalProjectId);
  const { members, loading: membersLoading, error: membersError, kickMember } = useProjectMembers(finalProjectId);

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [kickMemberId, setKickMemberId] = useState(null);
  const [showKickModal, setShowKickModal] = useState(false);

  const loggedInUserId = localStorage.getItem("userId");

  const handleEditProject = () => {
    setIsEditing(true);
    setEditedName(project.name);
    setEditedDescription(project.description);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!project) return;

    try {
      await editProject({
        id: project.id,
        name: editedName,
        description: editedDescription,
        projectOwnerID: project.projectOwnerID,
      });

      await refreshProject(); // Use the new refreshProject function
      setIsEditing(false);
    } catch (error) {
      console.error("❌ Failed to update project:", error.message);
    }
  };

  const handleKickMember = (memberId) => {
    setKickMemberId(memberId);
    setShowKickModal(true);
  };

  const confirmKickMember = async () => {
    if (!kickMemberId || !finalProjectId) return;

    try {
      await kickMember(kickMemberId);
      setKickMemberId(null);
      setShowKickModal(false);
    } catch (error) {
      console.error(`❌ Failed to remove user ${kickMemberId}:`, error.message);
    }
  };

  const cancelKickMember = () => {
    setShowKickModal(false);
    setKickMemberId(null);
  };

  if (projectLoading || membersLoading) return <p>Loading project details...</p>;

  return (
    <div className="project-details">
      {/* Rest of the JSX remains the same, but update error handling */}
      <div className="edit-buttons">
        {project?.projectOwnerID === loggedInUserId && isEditing ? (
          <>
            <button className="save-btn" onClick={handleSaveEdit}>
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button className="cancel-btn" onClick={handleCancelEdit}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </>
        ) : (
          project?.projectOwnerID === loggedInUserId && (
            <button className="edit-project-btn" onClick={handleEditProject}>
              <FontAwesomeIcon icon={faPenToSquare} />
            </button>
          )
        )}
      </div>

      {/* Project Details */}
      {!projectError && project && (
        <>
          {/* Project editing UI remains the same */}
          {isEditing ? (
            <input
              className="edit-title"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
            />
          ) : (
            <h1 className="project-title">{project.name}</h1>
          )}

          {isEditing ? (
            <textarea
              className="edit-description"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
            />
          ) : (
            <div className="project-description">{project.description}</div>
          )}

          <button className="invite-btn" onClick={() => navigate(`/invite`)}>
            Invite Members
          </button>
        </>
      )}

      {/* Members Section */}
      <div className="members-section">
        <h3>Members</h3>
        {membersError ? (
          <p className="error">{membersError}</p>
        ) : (
          <ul>
            {members.map((member) => (
              <li key={member.id} className={`member-item ${member.isOwner ? "owner" : ""}`}>
                {/* Member list UI remains the same */}
                <div className="member-info">
                  <span className="member-name">{member.name}</span>
                </div>
                <div className="member-actions">
                  {member.isOwner ? (
                    <FontAwesomeIcon icon={faCrown} className="crown" />
                  ) : (
                    project?.projectOwnerID === loggedInUserId && (
                      <FontAwesomeIcon
                        icon={faRightFromBracket}
                        className="kick-member"
                        onClick={() => handleKickMember(member.id)}
                      />
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Kick Member Modal remains the same */}
      {showKickModal && (
        <div className="modal-overlay active">
          <div className="modal">
            <h3>Confirm Removal</h3>
            <p>Are you sure you want to remove this member?</p>
            <div className="modal-actions">
              <button className="confirm-btn" onClick={confirmKickMember}>
                <FontAwesomeIcon icon={faCheck} />
              </button>
              <button className="cancel-btn" onClick={cancelKickMember}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;

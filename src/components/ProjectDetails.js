import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faCrown, faRightFromBracket, faXmark, faCheck } from "@fortawesome/free-solid-svg-icons";
import useProjectDetails from "../hooks/useProjectDetails";
import { getSelectedProject } from "../services/projectService";
import { editProject } from "../services/projectService"; 
import "../styles/project_details.css";

const ProjectDetails = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const storedProjectId = getSelectedProject();
  const finalProjectId = projectId || storedProjectId;

  console.log("Final Project ID:", finalProjectId);

  const { project, members, loading, errors, refreshProjectDetails, kickMember } = useProjectDetails(finalProjectId);

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [kickMemberId, setKickMemberId] = useState(null);
  const [showKickModal, setShowKickModal] = useState(false);

  // Get the actual logged-in user ID from localStorage
  const loggedInUserId = localStorage.getItem("userId"); 

  // Enter edit mode (only for the project owner)
  const handleEditProject = () => {
    setIsEditing(true);
    setEditedName(project.name);
    setEditedDescription(project.description);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // Save edited project (only for the project owner)
  const handleSaveEdit = async () => {
    if (!project) return;

    try {
      console.log("🛠️ Attempting to update project:", {
        id: project.id,
        name: editedName,
        description: editedDescription,
        projectOwnerID: project.projectOwnerID,
      });

      const updatedProject = await editProject({
        id: project.id,
        name: editedName,
        description: editedDescription,
        projectOwnerID: project.projectOwnerID,
      });

      console.log("✅ Project updated successfully. API response:", updatedProject);

      await refreshProjectDetails(); // Refresh project details after edit
      setIsEditing(false);
    } catch (error) {
      console.error("❌ Failed to update project:", error.message);
    }
  };

  // Show confirmation popup before kicking a member
  const handleKickMember = (memberId) => {
    setKickMemberId(memberId);
    setShowKickModal(true);
  };

  // Confirm kick (only project owner can remove members)
  const confirmKickMember = async () => {
    if (!kickMemberId || !finalProjectId) return;

    try {
      console.log(`🔥 Removing user ${kickMemberId} from project ${finalProjectId}`);

      await kickMember(kickMemberId); // Calls API and refreshes members list

      console.log(`✅ Successfully removed user ${kickMemberId}`);

      setKickMemberId(null);
      setShowKickModal(false);
    } catch (error) {
      console.error(`❌ Failed to remove user ${kickMemberId}:`, error.message);
    }
  };

  // Cancel kick confirmation
  const cancelKickMember = () => {
    setShowKickModal(false);
    setKickMemberId(null);
  };

  if (loading) return <p>Loading project details...</p>;

  return (
    <div className="project-details">
      {/* Edit & Cancel Buttons (ONLY for project owner) */}
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
      {!errors.projectError && project && (
        <>
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
        {errors.membersError ? (
          <p className="error">{errors.membersError}</p>
        ) : (
          <ul>
            {/* Member List */}
            {members.map((member) => (
              <li key={member.id} className={`member-item ${member.isOwner ? "owner" : ""}`}>
                <div className="member-info">
                  <span className="member-name">{member.name}</span>
                </div>
                <div className="member-actions">
                  {member.isOwner ? (
                    <FontAwesomeIcon icon={faCrown} className="crown" />
                  ) : (
                    // Show "Kick" button only if logged-in user is the project owner
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

      {/* Kick Member Confirmation Modal */}
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

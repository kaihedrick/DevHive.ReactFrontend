import React from "react";
import { useParams } from "react-router-dom";
import useProjectDetails from "../hooks/useProjectDetails";
import "../styles/project_details.css";

const ProjectDetails = () => {
  const { projectId } = useParams();
  const { project, members, projectError, membersError, loading } = useProjectDetails(projectId);

  const handleInviteMembers = () => {
    alert("Feature to invite members coming soon!");
  };

  if (loading) return <p>Loading project details...</p>;

  return (
    <div className="project-details">
      {/* Error Handling */}
      {projectError && <p className="error">{projectError}</p>}
      {membersError && <p className="error">{membersError}</p>}

      {/* If no errors, render project */}
      {!projectError && project && (
        <>
          <h2 className="project-title">{project.name}</h2>
          <div className="project-description">{project.description}</div>

          <button className="invite-btn" onClick={handleInviteMembers}>
            Invite Members
          </button>
        </>
      )}

      {/* Render members or error */}
      <div className="members-section">
        <h3>Members</h3>
        {membersError ? (
          <p className="error">{membersError}</p>
        ) : (
          <ul>
            {members.map((member) => (
              <li
                key={member.id}
                className={`member-item ${member.id === project.projectOwnerID ? "owner" : ""}`}
              >
                <span className="member-name">{member.name}</span>
                {member.id === project.projectOwnerID && <span className="owner-tag">(Owner)</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;

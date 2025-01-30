import React from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import useProjectDetails from "../hooks/useProjectDetails";
import { getSelectedProject } from "../services/projectService";
import "../styles/project_details.css";

const ProjectDetails = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const storedProjectId = getSelectedProject();
  const finalProjectId = projectId || storedProjectId;

  console.log("Final Project ID:", finalProjectId);

  const { project, members, loading, errors } = useProjectDetails(finalProjectId);

  const handleInviteMembers = () => {
    navigate(`/invite`);
  };

  if (loading) return <p>Loading project details...</p>;

  return (
    <div className="project-details">
      {errors.projectError && <p className="error">{errors.projectError}</p>}
      {errors.membersError && <p className="error">{errors.membersError}</p>}

      {/* Project Details */}
      {!errors.projectError && project && (
        <>
          <h1 className="project-title">{project.name}</h1>
          <div className="project-description">{project.description}</div>

          <button className="invite-btn" onClick={handleInviteMembers}>
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
            {members.map((member) => (
              <li key={member.id} className={`member-item ${member.isOwner ? "owner" : ""}`}>
                <span className="member-name">{member.name}</span>
                {member.isOwner && <span className="crown">👑</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;

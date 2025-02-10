import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faXmark, faTrash } from "@fortawesome/free-solid-svg-icons";
import useProjects from "../hooks/useProjects.js";
import "../styles/projects.css";

const Projects = () => {
  const [userId, setUserId] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");

    if (storedUserId && storedUserId !== userId) {
      setUserId(storedUserId);
    } else if (!storedUserId) {
      navigate("/");
    }
  }, [navigate, userId]);

  const { projects, loading, selectProject, deleteProject } = useProjects(userId);

  const handleProjectSelection = (e, projectId) => {
    if (editingProjectId) return;
    if (e.target.closest(".project-actions")) return;

    selectProject(projectId);
    localStorage.setItem("selectedProjectId", projectId);
    navigate(`/project-details`);
  };

  const handleDeleteProject = (projectId) => {
    setDeleteProjectId(projectId);
    setShowDeleteModal(true);
  };

  const confirmDeleteProject = async () => {
    if (!deleteProjectId) return;

    try {
      console.log(`🗑️ Confirming deletion of project: ${deleteProjectId}`);
      await deleteProject(deleteProjectId);
      setShowDeleteModal(false);
      setDeleteProjectId(null);
    } catch (error) {
      console.error(`❌ Failed to delete project:`, error.message);
    }
  };

  const cancelDeleteProject = () => {
    setShowDeleteModal(false);
    setDeleteProjectId(null);
  };

  const toggleEditMode = (projectId) => {
    setEditingProjectId(editingProjectId === projectId ? null : projectId);
  };

  if (loading) return <p className="loading">Loading projects...</p>;

  return (
    <div className="projects-container">
      <div className="header">
        <h1>Welcome to DevHive</h1>
        <p>Your Projects:</p>
      </div>

      <div className="projects-list">
        {projects.length > 0 ? (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isEditing={editingProjectId === project.id}
              onSelect={handleProjectSelection}
              onEdit={toggleEditMode}
              onDelete={handleDeleteProject}
              loggedInUserId={userId} // Pass user ID to ProjectCard
            />
          ))
        ) : (
          <p>No projects available.</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="actions">
        <button className="action-btn create-btn" onClick={() => navigate("/create-project")}>
          Create a Project
        </button>
        <button className="action-btn join-btn" onClick={() => navigate("/join-group")}>
          Join a Group
        </button>
        <button className="action-btn account-btn" onClick={() => navigate("/account-details")}>
          Account Details
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay active">
          <div className="modal">
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to remove this project?</p>
            <div className="modal-actions">
              <button className="confirm-btn" onClick={confirmDeleteProject}>
                <FontAwesomeIcon icon={faTrash} />
              </button>
              <button className="cancel-btn" onClick={cancelDeleteProject}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Ensure edit button is only visible to the project owner
const ProjectCard = ({ project, isEditing, onSelect, onEdit, onDelete, loggedInUserId }) => (
  <div
    className={`project-card ${isEditing ? "editing" : ""}`}
    tabIndex="0"
    role="button"
    aria-label={`View project ${project.name}`}
    onClick={(e) => onSelect(e, project.id)}
    onKeyPress={(e) => e.key === "Enter" && onSelect(e, project.id)}
  >
    <h3>{project.name}</h3>
    <p>{project.description}</p>

    {/* Delete button is only visible to project owners */}
    <div className="project-actions">
      {project.projectOwnerID === loggedInUserId && isEditing && (
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project.id);
          }}
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      )}

      {/* Edit button is only visible to project owners */}
      {project.projectOwnerID === loggedInUserId && (
        <button
          className="edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(project.id);
          }}
        >
          <FontAwesomeIcon icon={isEditing ? faXmark : faPenToSquare} />
        </button>
      )}
    </div>
  </div>
);

export default Projects;

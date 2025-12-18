import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { fetchUserProjects, updateProject, deleteProject } from "../services/projectService";
import { useNavigate } from "react-router-dom";
import { setSelectedProject, clearSelectedProject } from "../services/storageService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faTimes } from "@fortawesome/free-solid-svg-icons";
import ConfirmationModal from "./ConfirmationModal.tsx";
import "../styles/projects.css";
import "../styles/modal.css";

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const navigate = useNavigate();

  const hasFetched = useRef(false);

  useEffect(() => {
    // Clear selected project when entering projects list
    clearSelectedProject();
  }, []);

  useEffect(() => {
    if (hasFetched.current) return; // Prevent double fetch in React Strict Mode
    hasFetched.current = true;

    const loadProjects = async () => {
      try {
        const data = await fetchUserProjects();
        setProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError("We couldn't load your projects. Please try again.");
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const handleCreateProject = () => navigate("/create-project");
  const handleJoinProject = () => navigate("/join-group");
  const handleAccountDetails = () => navigate("/account-details");

  const refreshProjects = async () => {
    try {
      const data = await fetchUserProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error refreshing projects:", err);
    }
  };

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project.id);
    navigate("/project-details");
  };

  const handleSettingsClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditing(project);
  };

  return (
    <main className="projects-page with-footer-pad scroll-pad-bottom" role="main">
      {/* #region agent log */}
      {(() => {
        const logHeaderStyles = () => {
          setTimeout(() => {
            const header = document.querySelector('.projects-page .projects-header') as HTMLElement;
            const backlogHeader = document.querySelector('.backlog-page .backlog-header') as HTMLElement;
            if (header) {
              const computed = window.getComputedStyle(header);
              fetch('http://127.0.0.1:7242/ingest/3b72928f-107f-4672-aa90-6d4285c21018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Projects.tsx:80',message:'Projects header computed styles',data:{background:computed.background,backgroundColor:computed.backgroundColor,backgroundImage:computed.backgroundImage,backdropFilter:computed.backdropFilter,getPropertyValue_bgSecondary:computed.getPropertyValue('--bg-secondary'),allRules:Array.from(document.styleSheets).flatMap(sheet=>{try{return Array.from(sheet.cssRules||[]).filter(r=>r.selectorText?.includes('projects-header')).map(r=>({selector:r.selectorText,style:(r as CSSStyleRule).style.cssText})).slice(0,5)}catch{return[]}})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
            }
            if (backlogHeader) {
              const computed = window.getComputedStyle(backlogHeader);
              fetch('http://127.0.0.1:7242/ingest/3b72928f-107f-4672-aa90-6d4285c21018',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Projects.tsx:80',message:'Backlog header computed styles (from Projects page)',data:{background:computed.background,backgroundColor:computed.backgroundColor,backgroundImage:computed.backgroundImage,backdropFilter:computed.backdropFilter,getPropertyValue_bgSecondary:computed.getPropertyValue('--bg-secondary'),allRules:Array.from(document.styleSheets).flatMap(sheet=>{try{return Array.from(sheet.cssRules||[]).filter(r=>r.selectorText?.includes('backlog-header')).map(r=>({selector:r.selectorText,style:(r as CSSStyleRule).style.cssText})).slice(0,5)}catch{return[]}})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
            }
          }, 100);
        };
        logHeaderStyles();
        return null;
      })()}
      {/* #endregion */}
      <header className="projects-header" aria-label="Projects header">
        <div className="header-left">
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage your workspaces</p>
        </div>

        {/* Actions toolbar - visible on all screen sizes */}
        <div className="projects-toolbar">
          <button className="primary-action-btn" onClick={handleCreateProject}>
            <span className="btn-icon" aria-hidden>＋</span>
            New Project
          </button>
          <button className="secondary-action-btn" onClick={handleJoinProject}>
            Join Project
          </button>
          <button className="icon-btn" onClick={handleAccountDetails} aria-label="Account details" title="Account details">
            <FontAwesomeIcon icon={faCog} className="icon" aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="projects-container" aria-live="polite">
        {loading ? (
          <div className="loading">Loading your projects…</div>
        ) : error ? (
          <div className="error-banner" role="alert">{error}</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-illustration" aria-hidden>📁</div>
            <h2 className="empty-title">No Projects Yet</h2>
            <p className="empty-subtitle">Start a project or join an existing one.</p>
            <div className="empty-actions">
              <button className="empty-action-btn" onClick={handleCreateProject}>New Project</button>
              <button className="ghost-action-btn" onClick={handleJoinProject}>Join Project</button>
            </div>
          </div>
        ) : (
          <div className="projects-grid" role="list">
            {projects.map((project) => (
              <article
                key={project.id}
                className="project-card"
                role="listitem button"
                onClick={() => handleProjectClick(project)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleProjectClick(project);
                  }
                }}
                aria-label={`Open project ${project.name}`}
              >
                <div className="card-content">
                  <h3 className="project-title">{project.name}</h3>
                  <p className="project-metadata">{project.updated_at ? "Updated recently" : "Created recently"}</p>
                </div>
                
                {/* Card settings button (bottom-right overlay) */}
                <button
                  type="button"
                  aria-label={`Project settings for ${project.name}`}
                  className="card-settings-btn"
                  onClick={(e) => handleSettingsClick(e, project)}
                >
                  <FontAwesomeIcon icon={faCog} className="icon" aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Mobile: single FAB → action sheet with New / Join / Account (always available) */}
      {!loading && !error && (
        <>
          <button
            className="fab show-on-mobile"
            onClick={() => setFabOpen((v) => !v)}
            aria-label="Open actions"
          >
            <span className="fab__icon">＋</span>
          </button>

          {fabOpen && (
            <>
              <button className="fab-backdrop show-on-mobile" aria-label="Close actions" onClick={() => setFabOpen(false)} />
              <div className="fab-menu show-on-mobile" role="menu">
                <button role="menuitem" onClick={() => { setFabOpen(false); handleCreateProject(); }}>New Project</button>
                <button role="menuitem" onClick={() => { setFabOpen(false); handleJoinProject(); }}>Join Project</button>
                <button role="menuitem" onClick={() => { setFabOpen(false); handleAccountDetails(); }}>Account Details</button>
              </div>
            </>
          )}
        </>
      )}

      {/* Edit Project Modal */}
      {editing && (
        <EditProjectModal
          project={editing}
          onClose={() => setEditing(null)}
          onUpdated={() => { setEditing(null); refreshProjects(); }}
          onDeleted={() => { setEditing(null); refreshProjects(); }}
        />
      )}
    </main>
  );
};

// EditProjectModal Component
interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose, onUpdated, onDeleted }) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Lock scroll while modal is open (prevents background scroll on iOS)
  useEffect(() => {
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      document.body.classList.remove('modal-open');
    };
  }, []);

  const handleSave = async () => {
    try {
      setBusy(true);
      await updateProject(project.id, { name, description });
      onUpdated();
    } catch (error) {
      console.error("Error updating project:", error);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    try {
      setBusy(true);
      await deleteProject(project.id);
      onDeleted();
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const target = document.getElementById('modal-root') ?? document.body;

  const modalContent = (
    <div 
      className="modal is-open" 
      role="dialog" 
      aria-modal="true" 
      aria-label={`Edit ${project.name}`}
      onKeyDown={handleKeyDown}
    >
      <div className="modal__scrim" onClick={onClose} />
      <div className="modal__card">
        {/* Header with close button */}
        <header className="modal__header">
          <button 
            className="icon-btn" 
            aria-label="Close" 
            onClick={onClose}
            type="button"
          >
            <FontAwesomeIcon icon={faTimes} className="icon" aria-hidden="true" />
          </button>
          <h3 className="modal__title">Edit Project</h3>
        </header>

        {/* Body with form fields */}
        <div className="modal__body">
          <label htmlFor="edit-name">
            <span>Name</span>
            <input 
              id="edit-name"
              type="text"
              value={name} 
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              className="form-input"
            />
          </label>
          
          <label htmlFor="edit-description">
            <span>Description</span>
            <textarea 
              id="edit-description"
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
              rows={3}
              className="form-input"
            />
          </label>
        </div>

        {/* Footer with action buttons */}
        <footer className="modal__footer">
          <div className="form-actions">
            <button 
              className="secondary-action-btn" 
              onClick={onClose} 
              disabled={busy}
              type="button"
            >
              Cancel
            </button>
            <button 
              className="danger-action-btn" 
              onClick={handleDeleteClick} 
              disabled={busy}
              type="button"
            >
              Delete
            </button>
            <button 
              className="primary-action-btn" 
              onClick={handleSave} 
              disabled={busy}
              type="button"
            >
              Save
            </button>
          </div>
        </footer>
      </div>

      {/* Delete Confirmation Modal */}
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
    </div>
  );

  return createPortal(modalContent, target);
};

export default Projects;
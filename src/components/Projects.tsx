import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setSelectedProject, clearSelectedProject } from "../services/storageService";
import { storeAuthData } from "../services/authService.ts";
import { useProjects } from "../hooks/useProjects.ts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faBars } from "@fortawesome/free-solid-svg-icons";
import ProjectInspector from "./ProjectInspector.tsx";
import "../styles/projects.css";

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  ownerId?: string;
  owner?: {
    id: string;
  };
}

const Projects: React.FC = () => {
  const [editing, setEditing] = useState<Project | null>(null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const navigate = useNavigate();
  const { data: projectsData, isLoading: loading, error: queryError, refetch: refreshProjects } = useProjects();
  
  // Get logged-in user ID
  const loggedInUserId = localStorage.getItem("userId");

  // Extract projects array from response
  const projects: Project[] = Array.isArray(projectsData) ? projectsData : (projectsData?.projects || []);
  const error = queryError ? "We couldn't load your projects. Please try again." : null;

  useEffect(() => {
    // Clear selected project when entering projects list
    clearSelectedProject();
    
    // Handle OAuth callback token from URL hash
    // Backend redirects to frontend with token in hash: #token={base64-encoded-json}
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      try {
        // Extract and decode token data
        const tokenDataEncoded = hash.substring(7); // Remove '#token='
        const tokenDataJSON = atob(tokenDataEncoded); // Decode base64
        const tokenData = JSON.parse(tokenDataJSON);
        
        // Store the access token (for API requests)
        // storeAuthData handles both in-memory and localStorage storage
        storeAuthData(tokenData.token, tokenData.userId);
        
        console.log('✅ OAuth token stored from URL hash', { 
          userId: tokenData.userId, 
          isNewUser: tokenData.isNewUser 
        });
        
        // Optional: Handle new user onboarding
        if (tokenData.isNewUser) {
          // Show welcome message, profile completion, etc.
          console.log('Welcome new user!', tokenData.user);
          // You can add UI for new user onboarding here
          // e.g., show a welcome modal, redirect to profile completion, etc.
        }
        
        // Clear the hash from URL for clean UX
        window.history.replaceState(null, '', window.location.pathname);
        
        // Trigger auth state update by dispatching event
        window.dispatchEvent(new Event('auth-state-changed'));
      } catch (error) {
        console.error('❌ Failed to parse OAuth token data from hash:', error);
        // Clear invalid hash and redirect to login on error
        window.history.replaceState(null, '', window.location.pathname);
        // Optionally redirect to login if token parsing fails
        // window.location.href = '/';
      }
    }
  }, []);

  const handleCreateProject = () => navigate("/create-project");
  const handleAccountDetails = () => navigate("/account-details");

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project.id);
    navigate("/project-details");
  };

  const handleSettingsClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditing(project);
  };

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [menuOpen]);

  return (
    <main className="projects-page with-footer-pad scroll-pad-bottom" role="main">
      <header className="projects-header" aria-label="Projects header">
        <div className="header-left">
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage your workspaces</p>
        </div>

        {/* Actions toolbar - visible on desktop, hamburger menu on mobile */}
        <div className="projects-toolbar">
          {/* Desktop buttons */}
          <div className="projects-toolbar-buttons">
            <button className="primary-action-btn" onClick={handleCreateProject}>
              <span className="btn-icon" aria-hidden>＋</span>
              New Project
            </button>
            <button className="icon-btn" onClick={handleAccountDetails} aria-label="Account details" title="Account details">
              <FontAwesomeIcon icon={faCog} className="icon" aria-hidden="true" />
            </button>
          </div>
          
          {/* Mobile hamburger menu button */}
          <button 
            className="projects-hamburger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <FontAwesomeIcon icon={faBars} className="icon" aria-hidden="true" />
          </button>
        </div>
        
        {/* Mobile dropdown menu */}
        {menuOpen && (
          <>
            <div className="projects-menu-backdrop is-open" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="projects-menu-dropdown" role="menu">
              <button 
                className="projects-menu-item" 
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  handleCreateProject();
                }}
              >
                <span className="btn-icon" aria-hidden>＋</span>
                New Project
              </button>
              <button 
                className="projects-menu-item" 
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  handleAccountDetails();
                }}
              >
                <FontAwesomeIcon icon={faCog} className="icon" aria-hidden="true" />
                Account Details
              </button>
            </div>
          </>
        )}
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
            <p className="empty-subtitle">Start a project to get started.</p>
            <div className="empty-actions">
              <button className="empty-action-btn" onClick={handleCreateProject}>New Project</button>
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
                
                {/* Card settings button (bottom-right overlay) - Only visible to project owners */}
                {(() => {
                  const projectOwnerId = project.ownerId || project.owner?.id;
                  const isOwner = loggedInUserId && projectOwnerId && loggedInUserId === projectOwnerId;
                  
                  if (!isOwner) return null;
                  
                  return (
                    <button
                      type="button"
                      aria-label={`Project settings for ${project.name}`}
                      className="card-settings-btn"
                      onClick={(e) => handleSettingsClick(e, project)}
                    >
                      <FontAwesomeIcon icon={faCog} className="icon" aria-hidden="true" />
                    </button>
                  );
                })()}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Project Inspector */}
      <ProjectInspector
        project={editing}
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onUpdate={() => {
          setEditing(null);
          refreshProjects();
        }}
        onDelete={() => {
          setEditing(null);
          refreshProjects();
        }}
      />
    </main>
  );
};

export default Projects;
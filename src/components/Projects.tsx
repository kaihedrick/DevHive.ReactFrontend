import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setSelectedProject, clearSelectedProject } from "../services/storageService";
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
}

const Projects: React.FC = () => {
  const [editing, setEditing] = useState<Project | null>(null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const navigate = useNavigate();
  const { data: projectsData, isLoading: loading, error: queryError, refetch: refreshProjects } = useProjects();

  // Extract projects array from response
  const projects: Project[] = Array.isArray(projectsData) ? projectsData : (projectsData?.projects || []);
  const error = queryError ? "We couldn't load your projects. Please try again." : null;

  useEffect(() => {
    // Clear selected project when entering projects list
    clearSelectedProject();
  }, []);

  const handleCreateProject = () => navigate("/create-project");
  const handleJoinProject = () => navigate("/join-group");
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

        {/* Actions toolbar - visible on desktop, hamburger menu on mobile */}
        <div className="projects-toolbar">
          {/* Desktop buttons */}
          <div className="projects-toolbar-buttons">
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
                  handleJoinProject();
                }}
              >
                Join Project
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
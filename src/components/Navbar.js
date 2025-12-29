import React, { useEffect } from "react"; 
import { useNavigate, useLocation } from 'react-router-dom';
import "../styles/navbar.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTableColumns, faListCheck, faAddressBook, faUser } from "@fortawesome/free-solid-svg-icons";
import { ReactComponent as HiveIcon } from "./assets/hive-icon.svg";

/**
 * Navbar Component
 *
 * Renders a responsive navigation bar that adapts between a sidebar layout on desktop
 * and a topbar layout on mobile devices. Includes navigation to main sections of the app.
 *
 * CRITICAL: Uses onClick navigation instead of href to prevent full page reloads
 *
 * @component
 * @param {boolean} isMobile - Whether the current viewport is mobile (controlled by AppContent)
 * @returns {JSX.Element} Rendered navigation bar
 */
const Navbar = ({ isMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/board", icon: faTableColumns, label: "Board" },
    { path: "/backlog", icon: faListCheck, label: "Backlog" },
    { path: "/contacts", icon: faAddressBook, label: "Contacts" },
    { path: "/account-details", icon: faUser, label: "Account" },
  ];
  
  /**
   * Handle navigation click
   * Uses React Router's navigate() to perform SPA navigation
   * This prevents full page reloads and preserves app state
   */
  const handleNavClick = (e, path) => {
    e.preventDefault(); // Prevent default link behavior
    navigate(path);
  };

  return (
    <div className="navbar-wrapper">
      <nav className={`navbar ${isMobile ? 'topbar-mode' : 'sidebar-mode'}`}>
        <div className="navbar-content">
          <div 
            className={`logo-container ${isMobile ? 'mobile-logo' : ''}`} 
            onClick={() => navigate("/projects")}
          >
            <HiveIcon className="logo" />
            {!isMobile && <span className="logo-text">DevHive</span>}
          </div>
          <ul className="navbar-nav">
            {navItems.map((item, index) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={index} className="nav-item">
                  <a
                    href={item.path}
                    onClick={(e) => handleNavClick(e, item.path)}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <FontAwesomeIcon icon={item.icon} className="nav-icon" />
                    <span className="link-text">{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;

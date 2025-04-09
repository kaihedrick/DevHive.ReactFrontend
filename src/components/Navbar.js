import React, { useEffect } from "react"; 
import { useNavigate } from 'react-router-dom';
import "../styles/navbar.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTableColumns, faListCheck, faAddressBook, faUser } from "@fortawesome/free-solid-svg-icons";
import { ReactComponent as HiveIcon } from "./assets/hive-icon.svg";

const Navbar = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 600);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 600;
      setIsMobile(mobile);
    };
    
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const navItems = [
    { path: "/board", icon: faTableColumns, label: "Board" },
    { path: "/backlog", icon: faListCheck, label: "Backlog" },
    { path: "/contacts", icon: faAddressBook, label: "Contacts" },
    { path: "/account-details", icon: faUser, label: "Account" },
  ];

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
            {navItems.map((item, index) => (
              <li key={index} className="nav-item">
                <a href={item.path} className="nav-link">
                  <FontAwesomeIcon icon={item.icon} className="nav-icon" />
                  <span className="link-text">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;

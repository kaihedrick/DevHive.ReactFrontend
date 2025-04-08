import React, { useEffect } from "react"; 
import { useNavigate } from 'react-router-dom';
import "../styles/navbar.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTableColumns, faListCheck, faAddressBook, faUser } from "@fortawesome/free-solid-svg-icons";
import HiveIcon from "./assets/hive-icon.svg";

const Navbar = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 600);

  useEffect(() => {
    // Add sidebar class to body
    document.body.classList.add('has-sidebar');
    
    const handleResize = () => {
      const mobile = window.innerWidth <= 600;
      setIsMobile(mobile);
    };
    
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      // Remove sidebar class when component unmounts
      document.body.classList.remove('has-sidebar');
    };
  }, []);

  // Removed Sprint from the navigation items
  const navItems = [
    { path: "/board", icon: faTableColumns, label: "Board" },
    { path: "/backlog", icon: faListCheck, label: "Backlog" },
    { path: "/contacts", icon: faAddressBook, label: "Contacts" },
    { path: "/account-details", icon: faUser, label: "Account" },
  ];

  return (
    <nav className={`navbar ${isMobile ? 'topbar-mode' : 'sidebar-mode'}`}>
      <div className="navbar-content">
        {/* Logo container - now showing in both desktop and mobile */}
        <div 
          className={`logo-container ${isMobile ? 'mobile-logo' : ''}`} 
          onClick={() => navigate("/projects")}
        >
          <img src={HiveIcon} alt="DevHive Logo" className="logo" />
          {/* Logo text only shows in desktop hover state */}
          {!isMobile && <span className="logo-text">DevHive</span>}
        </div>

        {/* Navigation Items */}
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
  );
};

export default Navbar;

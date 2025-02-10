import React from "react"; 
import { useNavigation } from "../hooks/useNavigation";
import "../styles/navbar.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTableColumns, faListCheck, faAddressBook, faRocket, faUser } from "@fortawesome/free-solid-svg-icons";
import HiveIcon from "./assets/hive-icon.svg";

const Navbar = () => {
  const navigateTo = useNavigation();
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 600);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navItems = [
    { path: "/board", icon: faTableColumns, label: "Board" },
    { path: "/backlog", icon: faListCheck, label: "Backlog" },
    { path: "/contacts", icon: faAddressBook, label: "Contacts" },
    { path: "/sprint", icon: faRocket, label: "Sprint" },
    { path: "/account-details", icon: faUser, label: "Account" },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-content">
        {/* Only render logo in desktop mode */}
        {!isMobile && (
          <div className="logo-container" onClick={() => navigateTo("/projects")}>
            <img src={HiveIcon} alt="DevHive Logo" className="logo" />
            <span className="logo-text">DevHive</span>
          </div>
        )}

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

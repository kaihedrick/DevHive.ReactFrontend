import React, { useState } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import '../styles/navbar.css';
// Import images correctly
import DevHiveLogo from './assets/DevHiveLogo.png';
import BacklogIcon from './assets/backlog.png';
import ContactIcon from './assets/contacts.png';
import SprintIcon from './assets/sprint.png';
import BoardIcon from './assets/Board.png';
import AccountIcon from './assets/Account.png';  // Ensure filename matches
const Navbar = () => {
  const navigateTo = useNavigation();
  const [menuOpen, setMenuOpen] = useState(false);


  const navItems = [
    { path: '/board', icon: BoardIcon, alt: 'Board' },
    { path: '/backlog', icon: BacklogIcon, alt: 'Backlog' },
    { path: '/contacts', icon: ContactIcon, alt: 'Contacts' },
    { path: '/sprint', icon: SprintIcon, alt: 'Project Board' },
    { path: '/account-details', icon: AccountIcon, alt: 'Account Details' },
  ];

  return (
    <div className="navbar">
      <div className="logo-container">
        <img 
          src={DevHiveLogo}
          alt="DevHive Logo" 
          className="logo"
        />
        <span className="brand-name">DevHive</span>
      </div>

      {/* Burger menu for mobile screens */}
      <div className="burger-menu" onClick={() => setMenuOpen(!menuOpen)}>
        ☰
      </div>

      {/* Navigation items - show/hide based on state */}
      <div className={`nav-items ${menuOpen ? 'active' : ''}`}>
        {navItems.map((item, index) => (
          <img 
            key={index}
            src={item.icon}
            alt={item.alt}
            className="nav-icon"
            onClick={() => navigateTo(item.path)}
          />
        ))}
      </div>

      <button className="logout-btn" onClick={() => {
        localStorage.removeItem('authToken');
        navigateTo('/');
      }}>Logout</button>
    </div>
  );
};

export default Navbar;

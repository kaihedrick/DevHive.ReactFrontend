import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Projects from './components/Projects';
import Footer from './components/Footer';
import LoginRegister from './components/LoginRegister';
import Sprint from './components/Sprint';
import ForgotPassword from './components/ForgotPassword';
import ProtectedRoute from './components/ProtectedRoute';
import Backlog from './components/Backlog';
import Board from './components/Board';
import Contacts from './components/Contacts';
import Message from './components/Message';
import { getSelectedProject } from './services/projectService';
import ProjectDetails from './components/ProjectDetails';
import CreateProject from './components/CreateProject';
import InviteMembers from './components/InviteMembers';
import AccountDetails from './components/AccountDetails';
import JoinProject from './components/JoinProject';
import CreateSprint from './components/CreateSprint';
import CreateTask from './components/CreateTask';

function App() {
  const location = useLocation();
  const selectedProject = getSelectedProject();
  const [isTopbar, setIsTopbar] = useState(window.innerWidth <= 600);

  // Routes where Navbar should NOT appear
  const hideNavbarRoutes = ['/', '/forgot-password', '/create-project', '/projects', '/join-group', '/account-details'];
  const showNavbar = selectedProject && !hideNavbarRoutes.includes(location.pathname);

  useEffect(() => {
    const handleResize = () => {
      const topbar = window.innerWidth <= 600;
      setIsTopbar(topbar);
  
      const hideNavbarRoutes = ['/', '/forgot-password', '/create-project', '/projects', '/join-group', '/account-details'];
      const shouldHideNavbar = hideNavbarRoutes.includes(location.pathname);
  
      // Remove both classes first to avoid conflicts
      document.body.classList.remove("has-topbar", "has-sidebar");
  
      // Only apply if the navbar should be visible
      if (!shouldHideNavbar) {
        document.body.classList.add(topbar ? "has-topbar" : "has-sidebar");
      }
    };
  
    handleResize(); // Run on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [location.pathname]); // Add dependency to re-run on route change
  

  // Apply different background styles based on whether navbar is shown
  const getBackgroundStyle = () => ({
    background: showNavbar ? "#ffffff" : "linear-gradient(to bottom right, #f5c542, #ff9f1c)",
  });
  return (
      <div
        className={`app-container ${showNavbar ? (isTopbar ? "has-topbar" : "has-sidebar") : "full-screen"}`}
        style={getBackgroundStyle()}
      >
      {showNavbar && <Navbar />}
      <div className="content">
      <main>
        <Routes>
          {/** Public Routes */}
          <Route path="/" element={<LoginRegister />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/create-project" element={<CreateProject />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/join-group" element={<JoinProject />} />

          {/** Protected Routes */}
          <Route path="/project-details" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
          <Route path="/invite" element={<ProtectedRoute><InviteMembers /></ProtectedRoute>} />
          <Route path="/account-details" element={<ProtectedRoute><AccountDetails /></ProtectedRoute>} />
          <Route path="/sprint" element={<ProtectedRoute><Sprint /></ProtectedRoute>} />
          <Route path="/backlog" element={<ProtectedRoute><Backlog /></ProtectedRoute>} />
          <Route path="/board" element={<ProtectedRoute><Board /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Message /></ProtectedRoute>} />
          <Route path="/create-sprint" element={<ProtectedRoute><CreateSprint /></ProtectedRoute>} />
          <Route path="/create-task" element={<ProtectedRoute><CreateTask /></ProtectedRoute>} />

        </Routes>
      </main>

      {/** Footer always visible */}
      <Footer />
    </div>
      </div>
  );
}

export default App;

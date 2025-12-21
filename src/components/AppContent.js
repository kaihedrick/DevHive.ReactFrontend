import React, { useEffect, useState, Suspense, lazy, useMemo } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useRoutePermission } from '../hooks/useRoutePermission';
import { isProjectAgnosticRoute } from '../config/routeConfig.ts';
import Navbar from './Navbar';
import Footer from './Footer';
import ProtectedRoute from './ProtectedRoute.tsx';
import LoadingFallback from './LoadingFallback.tsx';
import '../styles/responsive.css'; // Import responsive utilities

// Lazy load route components
const LoginRegister = lazy(() => import('./LoginRegister.tsx'));
const Projects = lazy(() => import('./Projects.tsx'));
const Sprint = lazy(() => import('./Sprint'));
const ForgotPassword = lazy(() => import('./ForgotPassword.tsx'));
const Backlog = lazy(() => import('./Backlog.tsx'));
const Board = lazy(() => import('./Board.tsx'));
const Contacts = lazy(() => import('./Contacts'));
const Message = lazy(() => import('./Message.tsx'));
const ProjectDetails = lazy(() => import('./ProjectDetails.tsx'));
const CreateProject = lazy(() => import('./CreateProject.tsx'));
const InviteMembers = lazy(() => import('./InviteMembers'));
const AccountDetails = lazy(() => import('./AccountDetails'));
const InviteAcceptPage = lazy(() => import('./InviteAcceptPage.tsx'));
const CreateSprint = lazy(() => import('./CreateSprint.tsx'));
const CreateTask = lazy(() => import('./CreateTask.tsx'));
const EditSprint = lazy(() => import('./EditSprint.tsx'));
const EditTask = lazy(() => import('./EditTask.tsx'));
const ResetPassword = lazy(() => import('./ResetPassword.tsx'));

/**
 * AppContent - Main application content with routing
 * 
 * This component contains all the application routing logic and UI structure.
 * It's separated from App.js to provide stable component identity and prevent
 * unnecessary remounts of the provider tree.
 */
function AppContent() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  const { selectedProject } = useRoutePermission();

  // Debug logging - mount/unmount tracking
  useEffect(() => {
    console.log('🔵 AppContent MOUNTED');
    return () => {
      console.log('🔴 AppContent UNMOUNTED - this should NEVER happen during navigation!');
    };
  }, []);

  // Memoize showNavbar to prevent unnecessary re-renders
  const showNavbar = useMemo(() => {
    return !!selectedProject && !isProjectAgnosticRoute(location.pathname);
  }, [selectedProject, location.pathname]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 600;
      setIsMobile(mobile);
      
      // Update body classes for responsive behavior
      if (mobile) {
        document.body.classList.add('has-topbar');
        document.body.classList.remove('has-sidebar');
      } else {
        document.body.classList.add('has-sidebar');
        document.body.classList.remove('has-topbar');
      }
    };

    // Set initial state
    handleResize();
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update body classes when navbar visibility changes
  useEffect(() => {
    if (showNavbar) {
      if (isMobile) {
        document.body.classList.add('has-topbar');
        document.body.classList.remove('has-sidebar');
      } else {
        document.body.classList.add('has-sidebar');
        document.body.classList.remove('has-topbar');
      }
    } else {
      document.body.classList.remove('has-topbar', 'has-sidebar');
    }
  }, [showNavbar, isMobile]);

  const getBackgroundStyle = () => ({
    minHeight: showNavbar ? "auto" : "100vh",
    width: "100%",
  });

  return (
    <div
      className={`app-container ${showNavbar ? "has-navbar" : "full-screen"}`}
      style={getBackgroundStyle()}
    >
      {showNavbar && <Navbar />}
      <div className="content">
        <main>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<LoginRegister />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/create-project" element={<CreateProject />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/invite/:token" element={<InviteAcceptPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />

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
              <Route path="/edit-sprint/:sprintId" element={<ProtectedRoute><EditSprint /></ProtectedRoute>} />
              <Route path="/edit-task/:taskId" element={<EditTask />} />
              <Route path="/messages/:userId/:projectId" element={<Message />} />
            </Routes>
          </Suspense>
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default AppContent;

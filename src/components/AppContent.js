import React, { useEffect, useState, Suspense, lazy, useMemo, useLayoutEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useRoutePermission } from '../hooks/useRoutePermission';
import { isProjectAgnosticRoute } from '../config/routeConfig.ts';
import { useAuthContext } from '../contexts/AuthContext.tsx';
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
const GoogleOAuthCallback = lazy(() => import('./GoogleOAuthCallback.tsx'));

/**
 * AppContent - Main application content with routing
 *
 * This component contains all the application routing logic and UI structure.
 * It's separated from App.js to provide stable component identity and prevent
 * unnecessary remounts of the provider tree.
 */
/**
 * LoginRouteWrapper
 *
 * Wrapper component for the login route that redirects authenticated users
 * to /projects instead of showing the login page.
 *
 * Handles lazy-loaded LoginRegister component properly within Suspense boundary.
 *
 * Task 3: Never redirect from /login unless explicitly authenticated AND initialized
 */
const LoginRouteWrapper = () => {
  const { isAuthenticated, isLoading, authInitialized } = useAuthContext();

  // Task 2: Block ALL redirects until auth is initialized
  // Task 3: Never redirect from /login unless explicitly authenticated AND initialized
  if (!authInitialized || isLoading) {
    return <LoadingFallback />;
  }

  // Only redirect if auth is initialized AND user is authenticated
  if (authInitialized && isAuthenticated) {
    return <Navigate to="/projects" replace />;
  }

  // If not authenticated and auth is initialized, show login page (lazy-loaded component)
  // Suspense boundary in Routes will handle loading state
  return <LoginRegister />;
};

const MOBILE_MQL = "(max-width: 600px)";

function AppContent() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.matchMedia(MOBILE_MQL).matches);
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

  // Handle responsive behavior with matchMedia - single source of truth
  useLayoutEffect(() => {
    const mql = window.matchMedia(MOBILE_MQL);

    const apply = () => {
      const mobile = mql.matches;
      setIsMobile(mobile);

      document.body.classList.remove("has-sidebar", "has-topbar");

      if (showNavbar) {
        document.body.classList.add(mobile ? "has-topbar" : "has-sidebar");
      }
    };

    apply();

    // Safari fallback
    if (mql.addEventListener) mql.addEventListener("change", apply);
    else mql.addListener(apply);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", apply);
      else mql.removeListener(apply);

      document.body.classList.remove("has-sidebar", "has-topbar");
    };
  }, [showNavbar]);

  const getBackgroundStyle = () => ({
    minHeight: showNavbar ? "auto" : "100vh",
    width: "100%",
  });

  return (
    <div
      className={`app-container ${showNavbar ? "has-navbar" : "full-screen"}`}
      style={getBackgroundStyle()}
    >
      {showNavbar && <Navbar isMobile={isMobile} />}
      <div className="content">
        <main>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<LoginRouteWrapper />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/create-project" element={<CreateProject />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/invite/:token" element={<InviteAcceptPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<GoogleOAuthCallback />} />

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



import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { useRoutePermission } from './hooks/useRoutePermission';
import { isProjectAgnosticRoute } from './config/routeConfig.ts';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import LoadingFallback from './components/LoadingFallback';
import { ToastProvider } from './contexts/ToastContext.tsx';
import './styles/responsive.css'; // Import responsive utilities

// Lazy load route components
const LoginRegister = lazy(() => import('./components/LoginRegister.tsx'));
const Projects = lazy(() => import('./components/Projects.tsx'));
const Sprint = lazy(() => import('./components/Sprint'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword.tsx'));
const Backlog = lazy(() => import('./components/Backlog.tsx'));
const Board = lazy(() => import('./components/Board.tsx'));
const Contacts = lazy(() => import('./components/Contacts'));
const Message = lazy(() => import('./components/Message.tsx'));
const ProjectDetails = lazy(() => import('./components/ProjectDetails.tsx'));
const CreateProject = lazy(() => import('./components/CreateProject.tsx'));
const InviteMembers = lazy(() => import('./components/InviteMembers'));
const AccountDetails = lazy(() => import('./components/AccountDetails'));
const JoinProject = lazy(() => import('./components/JoinProject'));
const CreateSprint = lazy(() => import('./components/CreateSprint.tsx'));
const CreateTask = lazy(() => import('./components/CreateTask.tsx'));
const EditSprint = lazy(() => import('./components/EditSprint.tsx'));
const EditTask = lazy(() => import('./components/EditTask.tsx'));
const ResetPassword = lazy(() => import('./components/ResetPassword.tsx'));

function App() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  const { selectedProject } = useRoutePermission();

  // Show navbar only when we're on a project-scoped page AND a project is selected
  const showNavbar = !!selectedProject && !isProjectAgnosticRoute(location.pathname);

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
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
                    <Route path="/join-group" element={<JoinProject />} />
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
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

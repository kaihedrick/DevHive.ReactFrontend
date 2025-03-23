import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Projects from './components/Projects';
import Footer from './components/Footer';
import LoginRegister from './components/LoginRegister.tsx';
import Sprint from './components/Sprint';
import ForgotPassword from './components/ForgotPassword.tsx';
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
import EditSprint from './components/EditSprint';
import EditTask from './components/EditTask';
import ResetPassword from './components/ResetPassword.tsx';
import './styles/global.css'; // Import global styles
function App() {
  const location = useLocation();
  const selectedProject = getSelectedProject();

  const hideNavbarRoutes = ['/', '/forgot-password', '/create-project', '/projects', '/join-group', '/account-details'];
  const showNavbar = selectedProject && !hideNavbarRoutes.includes(location.pathname);

  const getBackgroundStyle = () => ({
    background: showNavbar ? "#ffffff" : "linear-gradient(to bottom right, #f5c542, #ff9f1c)",
  });

  return (
    <div
      className={`app-container ${showNavbar ? "has-navbar" : "full-screen"}`}
      style={getBackgroundStyle()}
    >
      {showNavbar && <Navbar />}
      <div className="content">
        <main>
          <Routes>
            <Route path="/" element={<LoginRegister />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/create-project" element={<CreateProject />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/join-group" element={<JoinProject />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password/:token" component={ResetPassword} />

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
            <Route path="/edit-sprint/:sprintId" element={<EditSprint />} />
            <Route path="/edit-task/:taskId" element={<EditTask />} />
            <Route path="/messages/:userId/:projectId" element={<Message />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default App;

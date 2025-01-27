import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import AccountDetails from './components/AccountDetails';
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

function App() {
  const location = useLocation();
  const selectedProject = getSelectedProject();

  // Define pages where the navbar should NOT be displayed
  const hideNavbarRoutes = ['/', '/forgot-password', '/create-project', '/projects'];

  return (
    <div>
      {/** Conditionally render navbar if a project is selected and not in restricted routes */}
      {selectedProject && !hideNavbarRoutes.includes(location.pathname) && <Navbar />}

      <Routes>
        {/** Public Routes */}
        <Route path="/" element={<LoginRegister />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/create-project" element={<CreateProject/>} />
        <Route path="/projects" element={<Projects/>} />   
  {/** Allow access to projects without protection */}
                <Route 
          path="/project-details" 
          element={
            <ProtectedRoute>
              <ProjectDetails />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sprint" 
          element={
            <ProtectedRoute>
              <Sprint />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/backlog" 
          element={
            <ProtectedRoute>
              <Backlog />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/board" 
          element={
            <ProtectedRoute>
              <Board />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/contacts" 
          element={
            <ProtectedRoute>
              <Contacts />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/messages" 
          element={
            <ProtectedRoute>
              <Message />
            </ProtectedRoute>
          } 
        />
      </Routes>

      {/** Footer always visible */}
      <Footer />
    </div>
  );
}

export default App;

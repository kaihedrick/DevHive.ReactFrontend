import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
<<<<<<< HEAD
import Projects from './components/Projects';
import Footer from './components/Footer';
import LoginRegister from './components/LoginRegister';
import ForgotPassword from './components/ForgotPassword';
=======
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Register from './components/Register';
import Projects from './components/Projects';
import Footer from './components/Footer';

>>>>>>> 90dd45ff33993cb9ae61c9d37a9887add43e2f11
function App() {
  return (
    <div>
      {/* Main app routes */}
      <Routes>
<<<<<<< HEAD
        <Route path="/" element={<LoginRegister />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
=======
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/projects" element={<Projects />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
>>>>>>> 90dd45ff33993cb9ae61c9d37a9887add43e2f11
      </Routes>
      {/* Footer always visible */}
      <Footer />
    </div>
  );
}

export default App;

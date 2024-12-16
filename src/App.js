import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Projects from './components/Projects';
import Footer from './components/Footer';
import LoginRegister from './components/LoginRegister';
import ForgotPassword from './components/ForgotPassword';
function App() {
  return (
    <div>
      {/* Main app routes */}
      <Routes>
        <Route path="/" element={<LoginRegister />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
      {/* Footer always visible */}
      <Footer />
    </div>
  );
}

export default App;

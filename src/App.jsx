import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewApplication from './pages/NewApplication';
import QRScan from './pages/QRScan';
import Records from './pages/Records';
import StaffManagement from './pages/StaffManagement';
import Settings from './pages/Settings';
import LoadingSpinner from './components/common/LoadingSpinner';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, isAdmin } = useAuth();
  
  if (loading) return <LoadingSpinner size="lg" />;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && !isAdmin) return <Navigate to="/new-application" replace />;
  
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/new-application" replace />} />
        <Route path="dashboard" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
        <Route path="new-application" element={<NewApplication />} />
        <Route path="qr-scan" element={<QRScan />} />
        <Route path="records" element={<Records />} />
        <Route path="staff" element={<ProtectedRoute adminOnly><StaffManagement /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <ToastContainer 
          position="top-right" 
          autoClose={3000} 
          hideProgressBar={false}
          closeOnClick
          pauseOnHover
          theme="light"
        />
      </Router>
    </AuthProvider>
  );
}

export default App;

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import RandevuAlPage from './pages/RandevuAlPage';
import RandevularimPage from './pages/RandevularimPage';

function PrivateRoute({ children }: { children: ReactElement }) {
  const { userId } = useAuth();
  return userId ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/patients" element={
        <PrivateRoute><PatientsPage /></PrivateRoute>
      } />
      <Route path="/patients/:id" element={
        <PrivateRoute><PatientDetailPage /></PrivateRoute>
      } />
      <Route path="/randevularim" element={
        <PrivateRoute><RandevularimPage /></PrivateRoute>
      } />
      <Route path="/randevu-al" element={
        <PrivateRoute><RandevuAlPage /></PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

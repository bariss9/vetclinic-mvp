import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import RandevuAlPage from './pages/RandevuAlPage';
import RandevularimPage from './pages/RandevularimPage';
import RandevuIstekleriPage from './pages/RandevuIstekleriPage';
import TakvimPage from './pages/TakvimPage';

function PrivateRoute({ children }: { children: ReactElement }) {
  const { userId } = useAuth();
  return userId ? children : <Navigate to="/" replace />;
}

function OwnerRoute({ children }: { children: ReactElement }) {
  const { userId, role } = useAuth();
  if (!userId) return <Navigate to="/" replace />;
  if (role === 'CLINIC') return <Navigate to="/patients" replace />;
  return children;
}

function ClinicRoute({ children }: { children: ReactElement }) {
  const { userId, role } = useAuth();
  if (!userId) return <Navigate to="/" replace />;
  if (role === 'OWNER') return <Navigate to="/patients" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* shared */}
      <Route path="/patients" element={
        <PrivateRoute><PatientsPage /></PrivateRoute>
      } />
      <Route path="/patients/:id" element={
        <PrivateRoute><PatientDetailPage /></PrivateRoute>
      } />

      {/* owner-only */}
      <Route path="/randevularim" element={
        <OwnerRoute><RandevularimPage /></OwnerRoute>
      } />
      <Route path="/randevu-al" element={
        <OwnerRoute><RandevuAlPage /></OwnerRoute>
      } />

      {/* clinic-only */}
      <Route path="/randevu-istekleri" element={
        <ClinicRoute><RandevuIstekleriPage /></ClinicRoute>
      } />
      <Route path="/takvim" element={
        <ClinicRoute><TakvimPage /></ClinicRoute>
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

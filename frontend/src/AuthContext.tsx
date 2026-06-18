import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { setToken, clearToken } from './api';

type Role = 'OWNER' | 'CLINIC';

interface AuthCtx {
  userId: number | null;
  role: Role | null;
  login: (token: string, userId: number, role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);
  const [role, setRole]     = useState<Role | null>(null);

  function login(token: string, id: number, userRole: Role) {
    setToken(token);
    setUserId(id);
    setRole(userRole);
  }

  function logout() {
    clearToken();
    setUserId(null);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ userId, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

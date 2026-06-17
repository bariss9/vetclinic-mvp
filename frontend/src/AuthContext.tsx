import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { setToken, clearToken } from './api';

interface AuthCtx {
  userId: number | null;
  login: (token: string, userId: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);

  function login(token: string, id: number) {
    setToken(token);
    setUserId(id);
  }

  function logout() {
    clearToken();
    setUserId(null);
  }

  return (
    <AuthContext.Provider value={{ userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

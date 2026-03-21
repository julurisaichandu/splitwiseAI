"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthState {
  isAuthenticated: boolean;
  userName: string | null;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  userName: null,
  isLoading: true,
  login: () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check auth status on mount
    fetch(`${API_URL}/api/auth/status`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setIsAuthenticated(data.authenticated);
        setUserName(data.user_name || null);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setUserName(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = () => {
    fetch(`${API_URL}/api/auth/splitwise/login`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.auth_url) {
          window.location.href = data.auth_url;
        }
      })
      .catch((err) => console.error("Login failed:", err));
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setUserName(null);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, userName, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

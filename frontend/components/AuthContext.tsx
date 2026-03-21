"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AuthState {
  isAuthenticated: boolean;
  userName: string | null;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  userName: null,
  isLoading: true,
  login: () => {},
  logout: async () => {},
  authFetch: () => Promise.resolve(new Response()),
});

export function useAuth() {
  return useContext(AuthContext);
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const TOKEN_KEY = "splitwise_session_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper: fetch with auth header
  const authFetch = useCallback((url: string, options: RequestInit = {}) => {
    const token = getToken();
    const headers = new Headers(options.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  }, []);

  useEffect(() => {
    // Check for session_token in URL (OAuth callback redirect)
    const params = new URLSearchParams(window.location.search);
    const token = params.get("session_token");
    if (token) {
      setToken(token);
      // Clean the URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Check auth status
    const storedToken = token || getToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    fetch(`${API_URL}/api/auth/status`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAuthenticated(true);
          setUserName(data.user_name || null);
        } else {
          clearToken();
        }
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = () => {
    fetch(`${API_URL}/api/auth/splitwise/login`)
      .then((res) => res.json())
      .then((data) => {
        if (data.auth_url) {
          window.location.href = data.auth_url;
        }
      })
      .catch((err) => console.error("Login failed:", err));
  };

  const logout = async () => {
    const token = getToken();
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // ignore
    }
    clearToken();
    setIsAuthenticated(false);
    setUserName(null);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, userName, isLoading, login, logout, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

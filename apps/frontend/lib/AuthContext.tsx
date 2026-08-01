'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { apiFetch, setAccessToken, getAccessToken, ApiException } from './api';
import { useRouter } from 'next/navigation';

interface AuthUser {
  id: string;
  role: 'structure' | 'admin' | 'employe' | 'livreur';
  structureId?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: { login?: string; email?: string; password: string }, isAdmin?: boolean) => Promise<void>;
  unifiedLogin: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Décode le payload d'un JWT sans vérification de signature (côté client) */
function decodeJwt(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function userFromToken(token: string): AuthUser | null {
  const payload = decodeJwt(token);
  if (!payload) return null;
  const role = payload.role as AuthUser['role'];
  // Pour un employé, structureId est dans le payload
  const structureId = payload.structureId || (role === 'structure' ? payload.entityId : undefined);
  return {
    id: payload.entityId,
    role,
    structureId,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Tente de rafraîchir le token au montage
  useEffect(() => {
    async function init() {
      try {
        const data = await apiFetch<{ accessToken: string }>(
          '/auth/refresh',
          { method: 'POST' },
          false,
        );
        setAccessToken(data.accessToken);
        setUser(userFromToken(data.accessToken));
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = useCallback(async (
    credentials: { login?: string; email?: string; password: string },
    isAdmin = false,
  ) => {
    const endpoint = isAdmin ? '/auth/admin/login' : '/auth/login';
    const data = await apiFetch<{ accessToken: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setAccessToken(data.accessToken);
    const u = userFromToken(data.accessToken);
    setUser(u);
    router.push(u?.role === 'admin' ? '/admin' : '/commande');
  }, [router]);

  const unifiedLogin = useCallback(async (identifier: string, password: string) => {
    const data = await apiFetch<{ accessToken: string; redirectTo?: string }>(
      '/auth/unified-login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setAccessToken(data.accessToken);
    const u = userFromToken(data.accessToken);
    setUser(u);
    if (data.redirectTo) {
      router.push(data.redirectTo);
    } else if (u?.role === 'admin') {
      router.push('/admin');
    } else if (u?.role === 'livreur') {
      router.push('/livreur/dashboard');
    } else {
      router.push('/commande');
    }
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      unifiedLogin,
      logout,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

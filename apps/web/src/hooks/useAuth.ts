'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, getErrorMsg } from '@/lib/api';
import { useGameStore } from '@/store/game.store';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  role: 'player' | 'admin' | 'moderator';
  isVerified: boolean;
}

export function useAuth() {
  const { setAuth, clearAuth, currentUserId, currentUserName } = useGameStore();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.getMe();
      setUser(data);
      setAuth(data.id, data.displayName, token);
    } catch {
      clearAuth();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.login(email, password);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setAuth(data.user?.id || '', data.user?.displayName || '', data.accessToken);
    await fetchMe();
    return data;
  };

  const register = async (email: string, password: string, displayName: string) => {
    const { data } = await api.register(email, password, displayName);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    await fetchMe();
    return data;
  };

  const logout = async () => {
    const rt = localStorage.getItem('refreshToken') || '';
    await api.logout(rt).catch(() => {});
    localStorage.clear();
    clearAuth();
    setUser(null);
    window.location.href = '/';
  };

  return { user, loading, login, register, logout, isAdmin: user?.role === 'admin' };
}

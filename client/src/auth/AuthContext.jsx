import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, AUTH_ENDPOINTS, TOKEN_STORAGE_KEY } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch(AUTH_ENDPOINTS.me);
      setUser(me);
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    const data = await apiFetch(AUTH_ENDPOINTS.login, {
      method: 'POST',
      body: { email, password },
    });
    if (!data?.token) {
      throw new Error('Token non ricevuto dal backend');
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(await apiFetch(AUTH_ENDPOINTS.me));
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await apiFetch(AUTH_ENDPOINTS.register, {
      method: 'POST',
      body: payload,
    });
    if (!data?.token) {
      throw new Error('Token non ricevuto dal backend');
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(await apiFetch(AUTH_ENDPOINTS.me));
    return data;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, register, refreshMe }),
    [user, loading, login, logout, register, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

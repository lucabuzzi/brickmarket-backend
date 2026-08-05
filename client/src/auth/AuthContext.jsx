import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, AUTH_ENDPOINTS, TOKEN_STORAGE_KEY } from '../api';
import { trackEvent } from '../analytics';
import { AuthContext } from './AuthContextObject';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ balanceCredits: 0.00 });

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setWallet({ balanceCredits: 0.00 });
  }, []);

  const refreshWallet = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) return;
    try {
      const data = await apiFetch('/api/wallet/balance');
      if (data && data.balanceCredits !== undefined) {
        setWallet({
          balanceCredits: parseFloat(data.balanceCredits)
        });
      }
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
    }
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
      await refreshWallet();
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshWallet]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const applyAuthResult = useCallback(async (data, eventName) => {
    if (!data?.token) {
      throw new Error('Token non ricevuto dal backend');
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(await apiFetch(AUTH_ENDPOINTS.me));
    await refreshWallet();
    trackEvent(eventName);
    return data;
  }, [refreshWallet]);

  const login = useCallback(async (email, password, turnstileToken) => {
    const data = await apiFetch(AUTH_ENDPOINTS.login, {
      method: 'POST',
      body: { email, password, turnstileToken },
    });
    return applyAuthResult(data, 'login');
  }, [applyAuthResult]);

  const register = useCallback(async (payload) => {
    const data = await apiFetch(AUTH_ENDPOINTS.register, {
      method: 'POST',
      body: payload,
    });
    return applyAuthResult(data, 'registration_completed');
  }, [applyAuthResult]);

  const loginWithGoogle = useCallback(async (credential) => {
    const data = await apiFetch(AUTH_ENDPOINTS.google, {
      method: 'POST',
      body: { credential },
    });
    return applyAuthResult(data, data?.isNewUser ? 'registration_completed' : 'login');
  }, [applyAuthResult]);

  const loginWithApple = useCallback(async (idToken, appleUser) => {
    const data = await apiFetch(AUTH_ENDPOINTS.apple, {
      method: 'POST',
      body: { id_token: idToken, user: appleUser },
    });
    return applyAuthResult(data, data?.isNewUser ? 'registration_completed' : 'login');
  }, [applyAuthResult]);

  const value = useMemo(
    () => ({
      user, loading, login, logout, register, refreshMe, wallet, setWallet, refreshWallet,
      loginWithGoogle, loginWithApple,
    }),
    [user, loading, login, logout, register, refreshMe, wallet, refreshWallet, loginWithGoogle, loginWithApple]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

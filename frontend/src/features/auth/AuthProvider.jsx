import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getSession, loginWithGoogle, logoutSession } from './auth.api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const sessionRequest = useRef(null);

  const refreshSession = useCallback(async () => {
    sessionRequest.current?.abort();
    const controller = new AbortController();
    sessionRequest.current = controller;
    setLoading(true);
    setSessionError('');
    try {
      const data = await getSession(controller.signal);
      if (!controller.signal.aborted) setUser(data.user);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error.status === 401) setUser(null);
      else setSessionError(error.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
    return () => sessionRequest.current?.abort();
  }, [refreshSession]);

  const signIn = useCallback(async (credential) => {
    sessionRequest.current?.abort();
    try {
      const data = await loginWithGoogle(credential);
      // A successful POST is not enough if the browser blocked the session cookie.
      const session = await getSession();
      if (session.user.id !== data.user.id) throw new Error('Sesi login tidak cocok. Silakan masuk kembali.');
      setUser(session.user);
      setSessionError('');
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    sessionRequest.current?.abort();
    await logoutSession();
    window.google?.accounts?.id?.disableAutoSelect?.();
    setUser(null);
    setSessionError('');
    setLoading(false);
  }, []);

  return <AuthContext.Provider value={{ user, loading, sessionError, refreshSession, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

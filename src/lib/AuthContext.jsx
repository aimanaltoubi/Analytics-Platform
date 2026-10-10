import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { localClient } from '@/api/localClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      setUser(await localClient.auth.me());
    } catch (error) {
      setUser(null);
      if (error.status !== 401) {
        console.error('Local authentication failed', error);
        setAuthError({ type: 'unavailable', message: error.message });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
    const expired = () => { setUser(null); };
    window.addEventListener('analytics:session-expired', expired);
    return () => window.removeEventListener('analytics:session-expired', expired);
  }, [checkUserAuth]);

  const logout = async () => {
    await localClient.auth.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: Boolean(user), isLoadingAuth, authError,
      authChecked: !isLoadingAuth, isLoadingPublicSettings: false,
      checkUserAuth, checkAppState: checkUserAuth, logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
